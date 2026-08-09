import { SignJWT, jwtVerify } from "jose";
import { getJwtSecret } from "./env";

const SESSION_ISSUER = "bookshare";
const SESSION_AUDIENCE = "bookshare-web";
export const LEGACY_SESSION_COOKIE_NAME = "session";
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-bookshare-session"
    : LEGACY_SESSION_COOKIE_NAME;
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export interface SessionPayload {
  userId: string;
  username: string;
  sessionVersion: number;
}

export async function createSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({
    username: payload.username,
    sessionVersion: payload.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  const secret = getJwtSecret();
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });

    const sessionVersion = payload.sessionVersion;
    if (
      typeof payload.sub !== "string" ||
      !/^[A-Za-z0-9]{21}$/.test(payload.sub) ||
      typeof payload.username !== "string" ||
      !/^[a-z0-9_-]{3,20}$/.test(payload.username) ||
      typeof sessionVersion !== "number" ||
      !Number.isInteger(sessionVersion) ||
      sessionVersion < 0
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      username: payload.username,
      sessionVersion,
    };
  } catch {
    return null;
  }
}
