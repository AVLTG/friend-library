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
});
