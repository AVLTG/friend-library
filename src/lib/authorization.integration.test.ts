// @vitest-environment node
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = `/tmp/bookshare-authorization-${process.pid}.db`;
const databaseUrl = `file:${databasePath}`;
const userId = "A12345678901234567890";

vi.mock("./auth", () => ({
  getSession: vi.fn(async () => ({
    userId,
    username: "role-user",
    sessionVersion: 0,
  })),
}));

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
    args: [userId, "role-user", "Role", "User", "hash", "#123456", "admin", 0, Date.now()],
  });
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

describe("database-backed authorization", () => {
  it("applies role changes without replacing the session", async () => {
    const { authorizeCurrentUser } = await import("./authorization");
    await expect(authorizeCurrentUser("admin")).resolves.toMatchObject({
      ok: true,
      user: { role: "admin" },
    });

    const client = createClient({ url: databaseUrl });
    await client.execute({
      sql: "UPDATE users SET role = 'member' WHERE id = ?",
      args: [userId],
    });
    client.close();

    await expect(authorizeCurrentUser("admin")).resolves.toMatchObject({
      ok: false,
      status: 403,
    });
  });
});
