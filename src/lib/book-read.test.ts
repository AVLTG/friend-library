// @vitest-environment node
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "./db/schema";
import { readBookDetail, readBookIdentities, readBooks } from "./book-read";

const databasePath = `/tmp/bookshare-book-read-${process.pid}.db`;
const databaseUrl = `file:${databasePath}`;
const currentUserId = "A12345678901234567890";
const secondUserId = "B12345678901234567890";
const thirdUserId = "C12345678901234567890";
const firstBookId = "D12345678901234567890";
const secondBookId = "E12345678901234567890";
const thirdBookId = "F12345678901234567890";
const createdAt = new Date("2026-08-08T10:00:00.000Z");
const updatedAt = new Date("2026-08-08T11:00:00.000Z");
const createdAtTimestamp = Math.floor(createdAt.getTime() / 1000);
const updatedAtTimestamp = Math.floor(updatedAt.getTime() / 1000);
const queries: string[] = [];
const client = createClient({ url: databaseUrl });
const database = drizzle(client, {
  schema,
  logger: {
    logQuery(query) {
      queries.push(query);
    },
  },
});

beforeAll(async () => {
  await migrate(database, { migrationsFolder: resolve("drizzle") });
  await client.batch(
    [
      {
        sql: `INSERT INTO users
          (id, username, first_name, last_name, password_hash, avatar_color, role, session_version, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          currentUserId,
          "current-reader",
          "Current",
          "Reader",
          "private-current-hash",
          "#111111",
          "admin",
          7,
          createdAtTimestamp,
        ],
      },
      {
        sql: `INSERT INTO users
          (id, username, first_name, last_name, password_hash, avatar_color, role, session_version, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          secondUserId,
          "second-reader",
          "Second",
          "Reader",
          "private-second-hash",
          "#222222",
          "member",
          3,
          createdAtTimestamp,
        ],
      },
      {
        sql: `INSERT INTO users
          (id, username, first_name, last_name, password_hash, avatar_color, role, session_version, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          thirdUserId,
          "third-reader",
          "Third",
          "Reader",
          "private-third-hash",
          "#333333",
          "member",
          0,
          createdAtTimestamp,
        ],
      },
      {
        sql: `INSERT INTO books
          (id, google_books_id, title, authors, isbn, description, cover_url, page_count, published_date, categories, spine_color, added_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          firstBookId,
          "primary-one",
          "Shared Book",
          '["Author One","Author Two"]',
          "9780140449235",
          "A shared book",
          "https://covers.openlibrary.org/b/isbn/9780140449235-L.jpg",
          320,
          "2026",
          '["Fiction"]',
          "#444444",
          currentUserId,
          createdAtTimestamp,
        ],
      },
      {
        sql: `INSERT INTO books
          (id, title, authors, cover_url, categories, spine_color, added_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          secondBookId,
          "Malformed Metadata",
          "not-json",
          "https://example.com/not-approved.jpg",
          '{"not":"an array"}',
          "#555555",
          secondUserId,
          createdAtTimestamp,
        ],
      },
      {
        sql: `INSERT INTO books
          (id, google_books_id, title, authors, spine_color, added_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          thirdBookId,
          "primary-three",
          "Third Book",
          '["Author Three"]',
          "#666666",
          thirdUserId,
          createdAtTimestamp,
        ],
      },
      ...[
        ["primary-one", firstBookId],
        ["alternate-one", firstBookId],
        ["alternate-one-b", firstBookId],
        ["orphan-alias", secondBookId],
        ["primary-three", thirdBookId],
        ["alternate-three", thirdBookId],
      ].map(([googleBooksId, bookId]) => ({
        sql: "INSERT INTO book_google_ids (google_books_id, book_id) VALUES (?, ?)",
        args: [googleBooksId, bookId],
      })),
      {
        sql: `INSERT INTO user_books
          (id, user_id, book_id, owned, currently_reading, rating, review, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "G12345678901234567890",
          currentUserId,
          firstBookId,
          1,
          1,
          4,
          "Current review",
          createdAtTimestamp,
          updatedAtTimestamp,
        ],
      },
      {
        sql: `INSERT INTO user_books
          (id, user_id, book_id, read, annotated, rating, review, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "H12345678901234567890",
          secondUserId,
          firstBookId,
          1,
          1,
          2,
          "Second review",
          createdAtTimestamp,
          updatedAtTimestamp,
        ],
      },
      {
        sql: `INSERT INTO user_books
          (id, user_id, book_id, owned, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          "I12345678901234567890",
          thirdUserId,
          firstBookId,
          1,
          createdAtTimestamp,
          updatedAtTimestamp,
        ],
      },
      {
        sql: `INSERT INTO user_books
          (id, user_id, book_id, read, rating, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "J12345678901234567890",
          secondUserId,
          thirdBookId,
          1,
          5,
          createdAtTimestamp,
          updatedAtTimestamp,
        ],
      },
      ...Array.from({ length: 72 }, (_, index) => ({
        sql: `INSERT INTO books
          (id, title, authors, spine_color, added_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          `S${String(index).padStart(20, "0")}`,
          `Scale Book ${index + 1}`,
          `["Scale Author ${index + 1}"]`,
          "#777777",
          currentUserId,
          createdAtTimestamp,
        ],
      })),
    ],
    "write",
  );
  queries.length = 0;
});

afterAll(async () => {
  client.close();
  await Promise.all([
    rm(databasePath, { force: true }),
    rm(`${databasePath}-shm`, { force: true }),
    rm(`${databasePath}-wal`, { force: true }),
  ]);
});

describe("shared book reads", () => {
  it("assembles compatible DTOs with three non-Cartesian bulk queries", async () => {
    const batch = vi.spyOn(database, "batch");
    const result = await readBooks(currentUserId, database);

    expect(batch).toHaveBeenCalledOnce();
    const statements = batch.mock.calls[0]?.[0] ?? [];
    expect(statements).toHaveLength(3);
    expect(result).toHaveLength(75);

    const sharedBook = result.find((book) => book.id === firstBookId);
    expect(sharedBook).toMatchObject({
      googleBooksId: "primary-one",
      googleBooksIds: ["primary-one", "alternate-one", "alternate-one-b"],
      title: "Shared Book",
      authors: ["Author One", "Author Two"],
      categories: ["Fiction"],
      coverUrl:
        "https://covers.openlibrary.org/b/isbn/9780140449235-L.jpg",
      createdAt: "2026-08-08T10:00:00.000Z",
      averageRating: 3,
      currentUserBook: {
        owned: true,
        read: false,
        currentlyReading: true,
        annotated: false,
        rating: 4,
        review: "Current review",
        updatedAt: "2026-08-08T11:00:00.000Z",
      },
    });
    expect(sharedBook?.owners.map((user) => user.id)).toEqual([
      currentUserId,
      thirdUserId,
    ]);
    expect(sharedBook?.readers.map((user) => user.id)).toEqual([secondUserId]);
    expect(sharedBook?.annotators.map((user) => user.id)).toEqual([
      secondUserId,
    ]);
    expect(sharedBook?.currentlyReading.map((user) => user.id)).toEqual([
      currentUserId,
    ]);
    expect(sharedBook?.ratings).toHaveLength(2);

    expect(result.find((book) => book.id === secondBookId)).toMatchObject({
      googleBooksIds: ["orphan-alias"],
      authors: [],
      categories: [],
      coverUrl: null,
      owners: [],
      readers: [],
      annotators: [],
      currentlyReading: [],
      ratings: [],
      averageRating: null,
      currentUserBook: null,
    });
  });

  it("assembles detail permissions and keeps query count fixed", async () => {
    queries.length = 0;
    const batch = vi.spyOn(database, "batch");
    const detail = await readBookDetail(
      firstBookId,
      {
        id: currentUserId,
        username: "current-reader",
        firstName: "Current",
        lastName: "Reader",
        avatarColor: "#111111",
      },
      true,
      database,
    );

    expect(batch).toHaveBeenCalledOnce();
    expect(batch.mock.calls[0]?.[0]).toHaveLength(3);
    expect(detail?.permissions).toEqual({
      canDeleteGlobally: true,
      canRemoveRelationship: true,
    });
    expect(detail?.currentUser).toEqual({
      id: currentUserId,
      username: "current-reader",
      firstName: "Current",
      lastName: "Reader",
      avatarColor: "#111111",
    });
    expect(detail?.owners).toHaveLength(2);
    expect(detail?.ratings).toHaveLength(2);

    queries.length = 0;
    const unrelatedDetail = await readBookDetail(
      secondBookId,
      {
        id: currentUserId,
        username: "current-reader",
        firstName: "Current",
        lastName: "Reader",
        avatarColor: "#111111",
      },
      false,
      database,
    );
    expect(batch).toHaveBeenCalledTimes(2);
    expect(batch.mock.calls[1]?.[0]).toHaveLength(3);
    expect(unrelatedDetail?.permissions).toEqual({
      canDeleteGlobally: false,
      canRemoveRelationship: false,
    });

    queries.length = 0;
    await client.execute({
      sql: `INSERT INTO books
        (id, title, authors, spine_color, added_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        "K12345678901234567890",
        "Fourth Book",
        '["Fourth Author"]',
        "#777777",
        currentUserId,
        createdAtTimestamp,
      ],
    });
    const allBooks = await readBooks(currentUserId, database);
    expect(allBooks).toHaveLength(76);
    expect(batch).toHaveBeenCalledTimes(3);
    expect(batch.mock.calls[2]?.[0]).toHaveLength(3);
  });

  it("loads only compact edition identity data with two queries", async () => {
    queries.length = 0;
    const batch = vi.spyOn(database, "batch");
    const identities = await readBookIdentities(database);

    expect(batch).toHaveBeenCalledOnce();
    expect(batch.mock.calls[0]?.[0]).toHaveLength(2);
    expect(identities.find((book) => book.id === firstBookId)).toEqual({
      id: firstBookId,
      googleBooksIds: ["primary-one", "alternate-one", "alternate-one-b"],
      isbn: "9780140449235",
      title: "Shared Book",
      authors: ["Author One", "Author Two"],
    });
    expect(identities.find((book) => book.id === secondBookId)?.authors).toEqual(
      [],
    );
  });
});
