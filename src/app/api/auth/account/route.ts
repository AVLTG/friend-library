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
import {
  apiError,
  requestBodyErrorResponse,
  withApiErrorBoundary,
} from "@/lib/api-response";
import { isSqliteUniqueConstraint } from "@/lib/db/errors";
import { maintenanceTransaction } from "@/lib/db/maintenance-write";
import { withSqliteBusyRetry } from "@/lib/db/transaction";

// Get current user info
export async function GET() {
  return withApiErrorBoundary(async () => {
  const session = await getSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
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
    return apiError("USER_NOT_FOUND", "User not found", 404);
  }

    return NextResponse.json(user);
  }, "Get account error", "Failed to load account");
}

// Update account details
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
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
      return apiError("USER_NOT_FOUND", "User not found", 404);
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
          return apiError(
            "RATE_LIMITED",
            "Too many password change attempts. Try again later.",
            429,
            { "Retry-After": String(Math.ceil(resetIn / 1000)) },
          );
        }
      } catch (error) {
        console.error("Password rate limit error:", error);
        return apiError(
          "SERVICE_UNAVAILABLE",
          "Password changes are temporarily unavailable",
          503,
        );
      }
    }

    const updates: Record<string, unknown> = {};
    let credentialsChanged = false;

    if (usernameChanging && !body.currentPassword) {
      return apiError(
        "CURRENT_PASSWORD_REQUIRED",
        "Current password is required to change username",
        400,
      );
    }

    if (credentialsChanging && body.currentPassword) {
      const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
      if (!valid) {
        return apiError(
          "CURRENT_PASSWORD_INCORRECT",
          "Current password is incorrect",
          400,
        );
      }
    }

    if (firstName !== undefined) {
      if (!firstName) {
        return apiError("INVALID_REQUEST", "First name cannot be empty", 400);
      }
      updates.firstName = firstName;
    }

    if (lastName !== undefined) {
      if (!lastName) {
        return apiError("INVALID_REQUEST", "Last name cannot be empty", 400);
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
        return apiError("USERNAME_TAKEN", "Username already taken", 409);
      }
      updates.username = username;
      credentialsChanged = true;
    }

    if (body.newPassword) {
      const passwordError = validatePassword(body.newPassword);
      if (passwordError) {
        return apiError("INVALID_PASSWORD", passwordError, 400);
      }

      updates.passwordHash = await bcrypt.hash(body.newPassword, 12);
      credentialsChanged = true;
    }

    if (Object.keys(updates).length === 0) {
      return apiError("INVALID_REQUEST", "No changes provided", 400);
    }

    if (credentialsChanged) {
      updates.sessionVersion = sql`${users.sessionVersion} + 1`;
    }

    const updatedUser = await withSqliteBusyRetry(() =>
      maintenanceTransaction((tx) =>
        tx
          .update(users)
          .set(updates)
          .where(eq(users.id, session.userId))
          .returning({
            username: users.username,
            sessionVersion: users.sessionVersion,
          })
          .get(),
      ),
    );

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
      return requestBodyErrorResponse(error);
    }
    if (isSqliteUniqueConstraint(error, ["users.username"])) {
      return apiError("USERNAME_TAKEN", "Username already taken", 409);
    }
    console.error("Account update error:", error);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
