import { afterEach, describe, expect, it, vi } from "vitest";
import { getAllowedOrigins, getJwtSecret, getTursoConfig } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("environment validation", () => {
  it("rejects missing and short JWT secrets", () => {
    vi.stubEnv("JWT_SECRET", "");
    expect(() => getJwtSecret()).toThrow(/at least 32 bytes/);

    vi.stubEnv("JWT_SECRET", "too-short");
    expect(() => getJwtSecret()).toThrow(/at least 32 bytes/);

    vi.stubEnv("JWT_SECRET", "your-secret-key-min-32-chars-long-here");
    expect(() => getJwtSecret()).toThrow(/at least 32 bytes/);
  });

  it("accepts a local file database without an auth token outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TURSO_DATABASE_URL", "file:/tmp/bookshare-test.db");
    vi.stubEnv("TURSO_AUTH_TOKEN", "");

    expect(getTursoConfig()).toEqual({
      url: "file:/tmp/bookshare-test.db",
      authToken: undefined,
    });
  });

  it("requires credentials for a remote database", () => {
    vi.stubEnv("TURSO_DATABASE_URL", "libsql://example.turso.io");
    vi.stubEnv("TURSO_AUTH_TOKEN", "");
    expect(() => getTursoConfig()).toThrow(/TURSO_AUTH_TOKEN/);
  });

  it("accepts only a bare configured application origin", () => {
    vi.stubEnv("APP_ORIGIN", "https://bookshare.example");
    expect(getAllowedOrigins()).toContain("https://bookshare.example");

    vi.stubEnv("APP_ORIGIN", "https://bookshare.example/path");
    expect(() => getAllowedOrigins()).toThrow(/origin/);
  });
});
