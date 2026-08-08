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
import { apiError, requestBodyErrorResponse } from "@/lib/api-response";
import { isSqliteUniqueConstraint } from "@/lib/db/errors";
import { maintenanceTransaction } from "@/lib/db/maintenance-write";

class InviteUnavailableError extends Error {}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  try {
    const { allowed, resetIn } = await checkRateLimit(ip, AUTH_LIMIT);
    if (!allowed) {
      return apiError(
        "RATE_LIMITED",
        `Too many attempts. Try again in ${Math.ceil(resetIn / 60000)} minutes.`,
        429,
        { "Retry-After": String(Math.ceil(resetIn / 1000)) },
      );
    }
  } catch (error) {
    console.error("Registration rate limit error:", error);
    return apiError(
      "SERVICE_UNAVAILABLE",
      "Registration is temporarily unavailable",
      503,
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
      return apiError(
        "INVALID_REQUEST",
        "First and last name are required",
        400,
      );
    }

    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(cleanUsername)) {
      return apiError(
        "INVALID_REQUEST",
        "Username must be 3-20 characters, letters/numbers/underscores/hyphens only",
        400,
      );
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return apiError("INVALID_PASSWORD", passwordError, 400);
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
      return apiError(
        "INVALID_INVITE",
        "Invalid or already used invite token",
        400,
      );
    }

    if (token.expiresAt < new Date()) {
      return apiError("INVITE_EXPIRED", "Invite token has expired", 400);
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, cleanUsername.toLowerCase()))
      .get();

    if (existing) {
      return apiError("USERNAME_TAKEN", "Username already taken", 409);
    }

    const userId = generateId();
    const passwordHash = await bcrypt.hash(password, 12);

    await withSqliteBusyRetry(() =>
      maintenanceTransaction(async (tx) => {
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
      return requestBodyErrorResponse(error);
    }
    if (error instanceof InviteUnavailableError) {
      return apiError(
        "INVALID_INVITE",
        "Invalid, expired, or already used invite token",
        400,
      );
    }
    if (isSqliteUniqueConstraint(error, ["users.username"])) {
      return apiError("USERNAME_TAKEN", "Username already taken", 409);
    }
    console.error("Registration error:", error);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
