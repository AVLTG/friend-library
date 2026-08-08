// @vitest-environment node
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = `/tmp/bookshare-invite-token-${process.pid}.db`;
const databaseUrl = `file:${databasePath}`;
const userId = "A12345678901234567890";

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
    args: [userId, "inviter", "Invite", "User", "hash", "#123456", "member", 0, Date.now()],
  });
  await client.execute({
    sql: `INSERT INTO invite_tokens
      (id, token, created_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: ["B12345678901234567890", "AAAA2222", userId, Date.now() + 60_000, Date.now()],
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

describe("invite token creation", () => {
  it("regenerates a token after a unique-token collision", async () => {
    const { createInviteForUser } = await import("./invite-token");
    const generate = vi
      .fn<() => string>()
      .mockReturnValueOnce("AAAA2222")
      .mockReturnValueOnce("BBBB3333");

    await expect(createInviteForUser(userId, generate)).resolves.toMatchObject({
      token: "BBBB3333",
      expiresAt: expect.any(Date),
    });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("fails after the bounded collision attempts are exhausted", async () => {
    const { createInviteForUser, InviteTokenGenerationError } = await import(
      "./invite-token"
    );
    const generate = vi.fn<() => string>().mockReturnValue("AAAA2222");

    await expect(createInviteForUser(userId, generate)).rejects.toBeInstanceOf(
      InviteTokenGenerationError,
    );
    expect(generate).toHaveBeenCalledTimes(4);
  });
});
