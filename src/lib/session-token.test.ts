// @vitest-environment node
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getJwtSecret } from "./env";
import { createSessionToken, verifySessionToken } from "./session-token";

const payload = {
  userId: "A12345678901234567890",
  username: "test-user",
  sessionVersion: 3,
};

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", "unit-test-secret-that-is-at-least-32-bytes-long");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session tokens", () => {
  it("round-trips strict session claims", async () => {
    const token = await createSessionToken(payload);
    await expect(verifySessionToken(token)).resolves.toEqual(payload);
  });

  it("rejects tampered and legacy tokens", async () => {
    const token = await createSessionToken(payload);
    const segments = token.split(".");
    const signature = segments[2];
    segments[2] = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    await expect(verifySessionToken(segments.join("."))).resolves.toBeNull();

    const legacyToken = await new SignJWT({ username: payload.username })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(payload.userId)
      .setIssuer("bookshare")
      .setAudience("bookshare-web")
      .setExpirationTime("1h")
      .sign(getJwtSecret());
    await expect(verifySessionToken(legacyToken)).resolves.toBeNull();
  });

  it("rejects tokens with the wrong issuer", async () => {
    const token = await new SignJWT({
      username: payload.username,
      sessionVersion: payload.sessionVersion,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(payload.userId)
      .setIssuer("another-app")
      .setAudience("bookshare-web")
      .setExpirationTime("1h")
      .sign(getJwtSecret());

    await expect(verifySessionToken(token)).resolves.toBeNull();
  });
});
