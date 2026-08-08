// @vitest-environment node
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = `/tmp/bookshare-initial-setup-${process.pid}.db`;
const databaseUrl = `file:${databasePath}`;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("TURSO_DATABASE_URL", databaseUrl);
  vi.stubEnv("TURSO_AUTH_TOKEN", "");

  const client = createClient({ url: databaseUrl });
  await migrate(drizzle(client), { migrationsFolder: resolve("drizzle") });
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

describe("initial setup", () => {
  it("creates exactly one user and invite across concurrent attempts", async () => {
    const {
      createInitialUserAndInvite,
      InitialSetupAlreadyCompletedError,
    } = await import("./initial-setup");

    const attempts = await Promise.allSettled(
      [0, 1].map((index) =>
        createInitialUserAndInvite({
          user: {
            id: index === 0 ? "A12345678901234567890" : "B12345678901234567890",
            username: `setup-user-${index}`,
            firstName: "Setup",
            lastName: index === 0 ? "Zero" : "One",
            passwordHash: "hash",
            avatarColor: "#123456",
            role: "admin",
          },
          invite: {
            id: index === 0 ? "C12345678901234567890" : "D12345678901234567890",
            token: index === 0 ? "AAAA2222" : "BBBB3333",
            createdBy:
              index === 0 ? "A12345678901234567890" : "B12345678901234567890",
            expiresAt: new Date(Date.now() + 60_000),
          },
        }),
      ),
    );

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.any(InitialSetupAlreadyCompletedError),
    });

    const client = createClient({ url: databaseUrl });
    const userCount = await client.execute("SELECT COUNT(*) AS count FROM users");
    const roles = await client.execute("SELECT role FROM users");
    const inviteCount = await client.execute(
      "SELECT COUNT(*) AS count FROM invite_tokens",
    );
    client.close();

    expect(Number(userCount.rows[0]?.count)).toBe(1);
    expect(roles.rows[0]?.role).toBe("admin");
    expect(Number(inviteCount.rows[0]?.count)).toBe(1);
  });
});
