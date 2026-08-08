import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getSession,
  validatePassword,
  createSession,
  setSessionCookie,
} from "@/lib/auth";
import { sanitizeName, sanitizeText } from "@/lib/sanitize";
import { checkRateLimit, PASSWORD_LIMIT } from "@/lib/rate-limit";
import {
  accountUpdateSchema,
  parseJsonBody,
  RequestBodyError,
} from "@/lib/validation";

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
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await parseJsonBody(request, accountUpdateSchema);
    const firstName =
      body.firstName !== undefined ? sanitizeName(body.firstName) : undefined;
    const lastName =
      body.lastName !== undefined ? sanitizeName(body.lastName) : undefined;
    const username =
      body.username !== undefined
        ? sanitizeText(body.username, 20).toLowerCase()
        : undefined;

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .get();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const usernameChanging =
      username !== undefined && username !== user.username;
    const credentialsChanging = usernameChanging || Boolean(body.newPassword);

    if (credentialsChanging) {
      try {
        const { allowed, resetIn } = await checkRateLimit(
          session.userId,
          PASSWORD_LIMIT,
        );
        if (!allowed) {
          return NextResponse.json(
            { error: "Too many password change attempts. Try again later." },
            {
              status: 429,
              headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) },
            },
          );
        }
      } catch (error) {
        console.error("Password rate limit error:", error);
        return NextResponse.json(
          { error: "Password changes are temporarily unavailable" },
          { status: 503 },
        );
      }
    }

    const updates: Record<string, unknown> = {};
    let credentialsChanged = false;

    if (usernameChanging && !body.currentPassword) {
      return NextResponse.json(
        { error: "Current password is required to change username" },
        { status: 400 },
      );
    }

    if (credentialsChanging && body.currentPassword) {
      const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 },
        );
      }
    }

    if (firstName !== undefined) {
      if (!firstName) {
        return NextResponse.json(
          { error: "First name cannot be empty" },
          { status: 400 },
        );
      }
      updates.firstName = firstName;
    }

    if (lastName !== undefined) {
      if (!lastName) {
        return NextResponse.json(
          { error: "Last name cannot be empty" },
          { status: 400 },
        );
      }
      updates.lastName = lastName;
    }

    if (usernameChanging && username !== undefined) {
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .get();

      if (existing) {
        return NextResponse.json(
          { error: "Username already taken" },
          { status: 400 },
        );
      }
      updates.username = username;
      credentialsChanged = true;
    }

    if (body.newPassword) {
      const passwordError = validatePassword(body.newPassword);
      if (passwordError) {
        return NextResponse.json({ error: passwordError }, { status: 400 });
      }

      updates.passwordHash = await bcrypt.hash(body.newPassword, 12);
      credentialsChanged = true;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    if (credentialsChanged) {
      updates.sessionVersion = sql`${users.sessionVersion} + 1`;
    }

    const updatedUser = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, session.userId))
      .returning({
        username: users.username,
        sessionVersion: users.sessionVersion,
      })
      .get();

    const response = NextResponse.json({ success: true });
    if (credentialsChanged) {
      const newToken = await createSession({
        userId: session.userId,
        username: updatedUser.username,
        sessionVersion: updatedUser.sessionVersion,
      });
      setSessionCookie(response, newToken);
    }

    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Account update error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
