import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, inviteTokens } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  createSession,
  generateId,
  validatePassword,
  randomAvatarColor,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, firstName, lastName, password, inviteToken } =
      await request.json();

    if (!username || !firstName || !lastName || !password || !inviteToken) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate username
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters, letters/numbers/underscores/hyphens only" },
        { status: 400 }
      );
    }

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // Check invite token
    const token = await db
      .select()
      .from(inviteTokens)
      .where(
        and(
          eq(inviteTokens.token, inviteToken.toUpperCase()),
          isNull(inviteTokens.usedBy)
        )
      )
      .get();

    if (!token) {
      return NextResponse.json(
        { error: "Invalid or already used invite token" },
        { status: 400 }
      );
    }

    if (token.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invite token has expired" },
        { status: 400 }
      );
    }

    // Check if username taken
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .get();

    if (existing) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 400 }
      );
    }

    // Create user
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

    // Mark invite token as used
    await db
      .update(inviteTokens)
      .set({ usedBy: userId, usedAt: new Date() })
      .where(eq(inviteTokens.id, token.id));

    // Create session
    const sessionToken = await createSession({
      userId,
      username: username.toLowerCase(),
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
