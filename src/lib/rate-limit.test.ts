// @vitest-environment node
import { createClient } from "@libsql/client";
import { rm } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = `/tmp/bookshare-rate-limit-${process.pid}.db`;
const databaseUrl = `file:${databasePath}`;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("TURSO_DATABASE_URL", databaseUrl);
  vi.stubEnv("TURSO_AUTH_TOKEN", "");
  const client = createClient({ url: databaseUrl });
  await client.execute(
    "CREATE TABLE rate_limit_buckets (id text PRIMARY KEY NOT NULL, count integer NOT NULL, reset_at integer NOT NULL)",
  );
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

describe("durable rate limiting", () => {
  it("enforces and isolates fixed-window buckets", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    const config = { name: "test", maxRequests: 2, windowMs: 60_000 };

    await expect(checkRateLimit("person-a", config)).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });
    await expect(checkRateLimit("person-a", config)).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
    await expect(checkRateLimit("person-a", config)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
    });
    await expect(checkRateLimit("person-b", config)).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("enforces the boundary across concurrent requests", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    const config = { name: "concurrent", maxRequests: 5, windowMs: 60_000 };
    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkRateLimit("person-c", config)),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(5);
  });
});

describe("trusted client IP extraction", () => {
  it("trusts only Vercel's platform header in production hosting", async () => {
    const { getClientIp } = await import("./rate-limit");
    vi.stubEnv("VERCEL", "1");
    const request = new Request("https://bookshare.example", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.4",
        "x-forwarded-for": "198.51.100.7",
      },
    });
    expect(getClientIp(request)).toBe("203.0.113.4");

    vi.stubEnv("VERCEL", "");
    expect(getClientIp(request)).toBe("unknown");
  });
});
