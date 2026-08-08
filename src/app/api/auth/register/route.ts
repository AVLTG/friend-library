import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, inviteTokens } from "@/lib/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import {
  createSession,
  setSessionCookie,
  generateId,
  validatePassword,
  randomAvatarColor,
} from "@/lib/auth";
import { sanitizeName, sanitizeText } from "@/lib/sanitize";
import { checkRateLimit, getClientIp, AUTH_LIMIT } from "@/lib/rate-limit";
import {
  parseJsonBody,
  registrationSchema,
  RequestBodyError,
} from "@/lib/validation";
import { withSqliteBusyRetry } from "@/lib/db/transaction";

class InviteUnavailableError extends Error {}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  try {
    const { allowed, resetIn } = await checkRateLimit(ip, AUTH_LIMIT);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${Math.ceil(resetIn / 60000)} minutes.` },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) },
        },
      );
    }
  } catch (error) {
    console.error("Registration rate limit error:", error);
    return NextResponse.json(
      { error: "Registration is temporarily unavailable" },
      { status: 503 },
    );
  }

  try {
    const { username, firstName, lastName, password, inviteToken } =
      await parseJsonBody(request, registrationSchema);

    const cleanUsername = sanitizeText(username, 20);
    const cleanFirstName = sanitizeName(firstName);
    const cleanLastName = sanitizeName(lastName);
    const cleanToken = sanitizeText(inviteToken, 8).toUpperCase();

    if (!cleanFirstName || !cleanLastName) {
      return NextResponse.json(
        { error: "First and last name are required" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(cleanUsername)) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters, letters/numbers/underscores/hyphens only" },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const token = await db
      .select()
      .from(inviteTokens)
      .where(
        and(
          eq(inviteTokens.token, cleanToken),
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

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, cleanUsername.toLowerCase()))
      .get();

    if (existing) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 400 }
      );
    }

    const userId = generateId();
    const passwordHash = await bcrypt.hash(password, 12);

    await withSqliteBusyRetry(() =>
      db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId,
          username: cleanUsername.toLowerCase(),
          firstName: cleanFirstName,
          lastName: cleanLastName,
          passwordHash,
          avatarColor: randomAvatarColor(),
          role: "member",
        });

        const claimedToken = await tx
          .update(inviteTokens)
          .set({ usedBy: userId, usedAt: new Date() })
          .where(
            and(
              eq(inviteTokens.id, token.id),
              isNull(inviteTokens.usedBy),
              gt(inviteTokens.expiresAt, new Date()),
            ),
          )
          .returning({ id: inviteTokens.id })
          .get();

        if (!claimedToken) {
          throw new InviteUnavailableError();
        }
      }),
    );

    const sessionToken = await createSession({
      userId,
      username: cleanUsername.toLowerCase(),
      sessionVersion: 0,
    });

    const response = NextResponse.json({ success: true });
    setSessionCookie(response, sessionToken);

    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof InviteUnavailableError) {
      return NextResponse.json(
        { error: "Invalid, expired, or already used invite token" },
        { status: 400 },
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
