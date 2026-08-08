// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("production session cookie", () => {
  it("uses a host-only name distinct from the legacy cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { LEGACY_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } = await import(
      "./session-token"
    );

    expect(SESSION_COOKIE_NAME).toBe("__Host-bookshare-session");
    expect(SESSION_COOKIE_NAME).not.toBe(LEGACY_SESSION_COOKIE_NAME);
  });
});
