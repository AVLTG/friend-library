// @vitest-environment node
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = `/tmp/bookshare-book-write-${process.pid}.db`;
const databaseUrl = `file:${databasePath}`;
const userId = "A12345678901234567890";
const bookId = "B12345678901234567890";

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("TURSO_DATABASE_URL", databaseUrl);
  vi.stubEnv("TURSO_AUTH_TOKEN", "");

  const client = createClient({ url: databaseUrl });
  await migrate(drizzle(client), { migrationsFolder: resolve("drizzle") });
  await client.execute({
    sql: `INSERT INTO users
      (id, username, first_name, last_name, password_hash, avatar_color, role, session_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, "owner", "Book", "Owner", "hash", "#123456", "member", 0, Date.now()],
  });
  await client.execute(`CREATE TRIGGER reject_owner_relationship
    BEFORE INSERT ON user_books WHEN NEW.book_id = '${bookId}'
    BEGIN SELECT RAISE(ABORT, 'owner relationship rejected'); END`);
  client.close();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await Promise.all([
    rm(databasePath, { force: true }),
    rm(`${databasePath}-shm`, { force: true }),
    rm(`${databasePath}-wal`, { force: true }),
  ]);
});

describe("book creation", () => {
  it("rolls back the book when owner relationship creation fails", async () => {
    const { createBookWithOwner } = await import("./book-write");

    await expect(
      createBookWithOwner(
        {
          id: bookId,
          title: "Rollback Book",
          authors: '["Test Author"]',
          spineColor: "#123456",
          addedBy: userId,
        },
        {
          id: "C12345678901234567890",
          userId,
          bookId,
          owned: true,
        },
      ),
    ).rejects.toThrow(/insert into "user_books"/);

    const client = createClient({ url: databaseUrl });
    const result = await client.execute({
      sql: "SELECT COUNT(*) AS count FROM books WHERE id = ?",
      args: [bookId],
    });
    client.close();
    expect(Number(result.rows[0]?.count)).toBe(0);
  });

  it("attaches ownership by canonical ISBN without overwriting relationship state", async () => {
    const client = createClient({ url: databaseUrl });
    await client.batch(
      [
        {
          sql: `INSERT INTO books
            (id, title, authors, isbn, spine_color, added_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            "D12345678901234567890",
            "Existing Edition",
            '["Test Author"]',
            "9780140449235",
            "#123456",
            userId,
            Date.now(),
          ],
        },
        {
          sql: `INSERT INTO user_books
            (id, user_id, book_id, owned, currently_reading, annotated, rating, review, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            "E12345678901234567890",
            userId,
            "D12345678901234567890",
            0,
            1,
            1,
            4,
            "Keep this",
            Date.now(),
            Date.now(),
          ],
        },
      ],
      "write",
    );
    client.close();

    const { createOrAttachBook } = await import("./book-write");
    const result = await createOrAttachBook(
      {
        id: "F12345678901234567890",
        googleBooksId: "different-google-result",
        title: "Existing Edition",
        authors: '["Test Author"]',
        isbn: "9780140449235",
        spineColor: "#654321",
        addedBy: userId,
      },
      {
        id: "G12345678901234567890",
        userId,
        bookId: "F12345678901234567890",
        owned: true,
      },
    );

    expect(result).toEqual({
      bookId: "D12345678901234567890",
      bookCreated: false,
      relationshipCreated: false,
      owned: true,
    });

    const check = createClient({ url: databaseUrl });
    const relationship = await check.execute({
      sql: `SELECT owned, currently_reading, annotated, rating, review
        FROM user_books WHERE user_id = ? AND book_id = ?`,
      args: [userId, "D12345678901234567890"],
    });
    check.close();
    expect(relationship.rows[0]).toMatchObject({
      owned: 1,
      currently_reading: 1,
      annotated: 1,
      rating: 4,
      review: "Keep this",
    });

    const aliasResult = await createOrAttachBook(
      {
        id: "L12345678901234567890",
        googleBooksId: "different-google-result",
        title: "Google-only Follow-up",
        authors: '["Test Author"]',
        spineColor: "#123456",
        addedBy: userId,
      },
      {
        id: "M12345678901234567890",
        userId,
        bookId: "L12345678901234567890",
        owned: true,
      },
    );
    expect(aliasResult.bookId).toBe("D12345678901234567890");
  });

  it("rejects identifiers that resolve to different books", async () => {
    const client = createClient({ url: databaseUrl });
    await client.batch(
      [
        {
          sql: `INSERT INTO books
            (id, google_books_id, title, authors, spine_color, added_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            "H12345678901234567890",
            "split-google",
            "Google Match",
            '["Author"]',
            "#123456",
            userId,
            Date.now(),
          ],
        },
        {
          sql: `INSERT INTO book_google_ids (google_books_id, book_id)
            VALUES (?, ?)`,
          args: ["split-google", "H12345678901234567890"],
        },
        {
          sql: `INSERT INTO books
            (id, title, authors, isbn, spine_color, added_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            "I12345678901234567890",
            "ISBN Match",
            '["Author"]',
            "9781443411066",
            "#123456",
            userId,
            Date.now(),
          ],
        },
      ],
      "write",
    );
    client.close();

    const { createOrAttachBook, BookIdentityConflictError } = await import(
      "./book-write"
    );
    await expect(
      createOrAttachBook(
        {
          id: "J12345678901234567890",
          googleBooksId: "split-google",
          title: "Conflicting Edition",
          authors: '["Author"]',
          isbn: "9781443411066",
          spineColor: "#123456",
          addedBy: userId,
        },
        {
          id: "K12345678901234567890",
          userId,
          bookId: "J12345678901234567890",
          owned: true,
        },
      ),
    ).rejects.toBeInstanceOf(BookIdentityConflictError);
  });

  it("consolidates concurrent creates for the same edition", async () => {
    const { createOrAttachBook } = await import("./book-write");
    const create = (bookId: string, relationshipId: string) =>
      createOrAttachBook(
        {
          id: bookId,
          googleBooksId: "concurrent-google",
          title: "Concurrent Edition",
          authors: '["Author"]',
          isbn: "9780062000767",
          spineColor: "#123456",
          addedBy: userId,
        },
        {
          id: relationshipId,
          userId,
          bookId,
          owned: true,
        },
      );

    const results = await Promise.all([
      create("N12345678901234567890", "O12345678901234567890"),
      create("P12345678901234567890", "Q12345678901234567890"),
    ]);
    expect(new Set(results.map((result) => result.bookId)).size).toBe(1);

    const client = createClient({ url: databaseUrl });
    const count = await client.execute({
      sql: "SELECT COUNT(*) AS count FROM books WHERE isbn = ?",
      args: ["9780062000767"],
    });
    client.close();
    expect(Number(count.rows[0]?.count)).toBe(1);
  });

  it("persists an ISBN learned for an existing Google identity", async () => {
    const client = createClient({ url: databaseUrl });
    await client.batch(
      [
        {
          sql: `INSERT INTO books
            (id, google_books_id, title, authors, spine_color, added_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            "R12345678901234567890",
            "google-first",
            "Google First",
            '["Author"]',
            "#123456",
            userId,
            Date.now(),
          ],
        },
        {
          sql: "INSERT INTO book_google_ids (google_books_id, book_id) VALUES (?, ?)",
          args: ["google-first", "R12345678901234567890"],
        },
      ],
      "write",
    );
    client.close();

    const { createOrAttachBook, BookIdentityConflictError } = await import(
      "./book-write"
    );
    await createOrAttachBook(
      {
        id: "S12345678901234567890",
        googleBooksId: "google-first",
        title: "Google First",
        authors: '["Author"]',
        isbn: "9781250796820",
        spineColor: "#123456",
        addedBy: userId,
      },
      {
        id: "T12345678901234567890",
        userId,
        bookId: "S12345678901234567890",
        owned: true,
      },
    );
    const isbnOnly = await createOrAttachBook(
      {
        id: "U12345678901234567890",
        title: "ISBN Follow-up",
        authors: '["Author"]',
        isbn: "9781250796820",
        spineColor: "#123456",
        addedBy: userId,
      },
      {
        id: "V12345678901234567890",
        userId,
        bookId: "U12345678901234567890",
        owned: true,
      },
    );
    expect(isbnOnly.bookId).toBe("R12345678901234567890");

    await expect(
      createOrAttachBook(
        {
          id: "W12345678901234567890",
          googleBooksId: "google-first",
          title: "Contradictory ISBN",
          authors: '["Author"]',
          isbn: "9781647290245",
          spineColor: "#123456",
          addedBy: userId,
        },
        {
          id: "X12345678901234567890",
          userId,
          bookId: "W12345678901234567890",
          owned: true,
        },
      ),
    ).rejects.toBeInstanceOf(BookIdentityConflictError);
  });
});
