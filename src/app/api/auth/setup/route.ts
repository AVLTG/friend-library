import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, inviteTokens } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import {
  createSession,
  generateId,
  generateInviteToken,
  validatePassword,
  randomAvatarColor,
} from "@/lib/auth";
import { sanitizeName, sanitizeText } from "@/lib/sanitize";
import { checkRateLimit, getClientIp, AUTH_LIMIT } from "@/lib/rate-limit";

// First-time setup: creates the first admin user (no invite needed)
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed } = checkRateLimit(ip, AUTH_LIMIT);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  try {
    const userCount = await db.select({ count: count() }).from(users).get();

    if (userCount && userCount.count > 0) {
      return NextResponse.json(
        { error: "Setup already completed" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const username = sanitizeText(body.username || "", 20);
    const firstName = sanitizeName(body.firstName || "");
    const lastName = sanitizeName(body.lastName || "");
    const password = body.password;

    if (!username || !firstName || !lastName || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters, letters/numbers/underscores/hyphens only" },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const userId = generateId();
    const passwordHash = await bcrypt.hash(password, 12);

    await db.insert(users).values({
      id: userId,
      username: username.toLowerCase(),
      firstName,
      lastName,
      passwordHash,
      avatarColor: randomAvatarColor(),
    });

    // Generate first invite token for the admin to share
    const token = generateInviteToken();
    await db.insert(inviteTokens).values({
      id: generateId(),
      token,
      createdBy: userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    const sessionToken = await createSession({
      userId,
      username: username.toLowerCase(),
    });

    const response = NextResponse.json({
      success: true,
      inviteToken: token,
      message: "Account created! Share the invite token with your friends.",
    });

    response.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
