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

  it("allows Vercel preview and stable branch origins", () => {
    vi.stubEnv("APP_ORIGIN", "https://bookshare.example");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "friend-library-git-sha.vercel.app");
    vi.stubEnv("VERCEL_BRANCH_URL", "friend-library-git-feature.vercel.app");

    expect(getAllowedOrigins()).toEqual(
      new Set([
        "https://bookshare.example",
        "https://friend-library-git-sha.vercel.app",
        "https://friend-library-git-feature.vercel.app",
      ]),
    );
  });

  it("uses the canonical BookShare origin in production by default", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "");

    expect(getAllowedOrigins()).toEqual(
      new Set(["https://bookshare.avltg.dev"]),
    );
  });
});
