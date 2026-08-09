// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookupSessionVersion } from "./lib/db/session-version";
import { createSessionToken } from "./lib/session-token";
import { middleware } from "./middleware";

vi.mock("./lib/db/session-version", () => ({
  lookupSessionVersion: vi.fn(),
}));

const lookupSessionVersionMock = vi.mocked(lookupSessionVersion);

beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://bookshare.example");
  vi.stubEnv("JWT_SECRET", "middleware-test-secret-at-least-32-bytes-long");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("TURSO_DATABASE_URL", "file:/tmp/bookshare-middleware.db");
  vi.stubEnv("TURSO_AUTH_TOKEN", "");
  lookupSessionVersionMock.mockResolvedValue({
    checked: false,
    sessionVersion: null,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("middleware security", () => {
  it("rejects unsafe requests without an approved Origin", async () => {
    const request = new NextRequest("https://bookshare.example/api/auth/login", {
      method: "POST",
    });
    const response = await middleware(request);

    expect(response.status).toBe(403);
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'self'",
    );
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request origin",
      code: "INVALID_ORIGIN",
    });
  });

  it("returns JSON 401 for protected APIs without a session", async () => {
    const response = await middleware(
      new NextRequest("https://bookshare.example/api/books"),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  });

  it("returns a stable JSON error when API origin configuration is invalid", async () => {
    vi.stubEnv("APP_ORIGIN", "not-an-origin");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await middleware(
      new NextRequest("https://bookshare.example/api/books", {
        method: "POST",
        headers: { origin: "https://bookshare.example" },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Security configuration unavailable",
      code: "SECURITY_CONFIGURATION_UNAVAILABLE",
    });
    consoleError.mockRestore();
  });

  it("redirects a valid session away from login", async () => {
    const token = await createSessionToken({
      userId: "A12345678901234567890",
      username: "test-user",
      sessionVersion: 0,
    });
    const request = new NextRequest("https://bookshare.example/login", {
      headers: { cookie: `session=${token}` },
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://bookshare.example/library",
    );
  });

  it("clears malformed sessions on protected redirects", async () => {
    const request = new NextRequest("https://bookshare.example/library", {
      headers: { cookie: "session=invalid" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects sessions revoked in the remote database", async () => {
    lookupSessionVersionMock.mockResolvedValue({
      checked: true,
      sessionVersion: 2,
    });
    const token = await createSessionToken({
      userId: "A12345678901234567890",
      username: "test-user",
      sessionVersion: 1,
    });
    const request = new NextRequest("https://bookshare.example/library", {
      headers: { cookie: `session=${token}` },
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
