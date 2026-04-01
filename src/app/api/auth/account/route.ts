import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession, validatePassword, createSession } from "@/lib/auth";

// Get current user info
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarColor: users.avatarColor,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .get();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// Update account details
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { firstName, lastName, username, currentPassword, newPassword } = body;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .get();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  // Update display name
  if (firstName !== undefined) {
    if (!firstName.trim()) {
      return NextResponse.json(
        { error: "First name cannot be empty" },
        { status: 400 }
      );
    }
    updates.firstName = firstName.trim();
  }

  if (lastName !== undefined) {
    if (!lastName.trim()) {
      return NextResponse.json(
        { error: "Last name cannot be empty" },
        { status: 400 }
      );
    }
    updates.lastName = lastName.trim();
  }

  // Update username
  if (username !== undefined) {
    const newUsername = username.toLowerCase().trim();
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(newUsername)) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters, letters/numbers/underscores/hyphens only" },
        { status: 400 }
      );
    }

    if (newUsername !== user.username) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.username, newUsername))
        .get();

      if (existing) {
        return NextResponse.json(
          { error: "Username already taken" },
          { status: 400 }
        );
      }
      updates.username = newUsername;
    }
  }

  // Update password
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password is required to set a new password" },
        { status: 400 }
      );
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    updates.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, session.userId));

  // If username changed, issue a new session token
  let response = NextResponse.json({ success: true });
  if (updates.username) {
    const newToken = await createSession({
      userId: session.userId,
      username: updates.username as string,
    });
    response.cookies.set("session", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }

  return response;
}
