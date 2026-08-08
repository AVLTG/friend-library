import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import {
  createSessionToken,
  LEGACY_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  type SessionPayload,
  verifySessionToken,
} from "./session-token";

export type { SessionPayload } from "./session-token";

export async function createSession(payload: SessionPayload): Promise<string> {
  return createSessionToken(payload);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  const user = await db
    .select({ sessionVersion: users.sessionVersion })
    .from(users)
    .where(eq(users.id, session.userId))
    .get();

  if (user?.sessionVersion !== session.sessionVersion) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return session;
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  if (SESSION_COOKIE_NAME !== LEGACY_SESSION_COOKIE_NAME) {
    expireSessionCookie(response, LEGACY_SESSION_COOKIE_NAME);
  }
}

function expireSessionCookie(response: NextResponse, name: string): void {
  response.cookies.set(name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse): void {
  expireSessionCookie(response, SESSION_COOKIE_NAME);
  if (SESSION_COOKIE_NAME !== LEGACY_SESSION_COOKIE_NAME) {
    expireSessionCookie(response, LEGACY_SESSION_COOKIE_NAME);
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .get();

  return user || null;
}

export function generateId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const bytes = new Uint8Array(21);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 21; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function generateInviteToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars
  let result = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

const SPINE_COLORS = [
  "#8B3A3A", "#3A5A8B", "#3A6B4F", "#6B4F36", "#722F37",
  "#2C3E6B", "#2D5A3D", "#5B3256", "#8B4513", "#2F6B6B",
  "#4A5568", "#744210", "#553C7B", "#2B6CB0", "#9B2C2C",
];

export function randomSpineColor(): string {
  return SPINE_COLORS[Math.floor(Math.random() * SPINE_COLORS.length)];
}

export function validatePassword(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain a number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain a special character";
  return null;
}

const AVATAR_COLORS = [
  "#E07A5F", "#3D405B", "#81B29A", "#F2CC8F", "#264653",
  "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51", "#606C38",
  "#DDA15E", "#BC6C25", "#6D6875", "#B5838D", "#E5989B",
];

export function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}
