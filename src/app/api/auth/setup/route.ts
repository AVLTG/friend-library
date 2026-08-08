import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  createSession,
  setSessionCookie,
  generateId,
  generateInviteToken,
  validatePassword,
  randomAvatarColor,
} from "@/lib/auth";
import { sanitizeName, sanitizeText } from "@/lib/sanitize";
import { checkRateLimit, getClientIp, AUTH_LIMIT } from "@/lib/rate-limit";
import { parseJsonBody, RequestBodyError, setupSchema } from "@/lib/validation";
import {
  createInitialUserAndInvite,
  InitialSetupAlreadyCompletedError,
} from "@/lib/initial-setup";
import { apiError, requestBodyErrorResponse } from "@/lib/api-response";

// First-time setup: creates the first admin user (no invite needed)
export async function POST(request: Request) {
  const ip = getClientIp(request);
  try {
    const { allowed, resetIn } = await checkRateLimit(ip, AUTH_LIMIT);
    if (!allowed) {
      return apiError(
        "RATE_LIMITED",
        "Too many attempts.",
        429,
        { "Retry-After": String(Math.ceil(resetIn / 1000)) },
      );
    }
  } catch (error) {
    console.error("Setup rate limit error:", error);
    return apiError(
      "SERVICE_UNAVAILABLE",
      "Setup is temporarily unavailable",
      503,
    );
  }

  try {
    const body = await parseJsonBody(request, setupSchema);
    const username = sanitizeText(body.username, 20);
    const firstName = sanitizeName(body.firstName);
    const lastName = sanitizeName(body.lastName);
    const password = body.password;

    if (!firstName || !lastName) {
      return apiError(
        "INVALID_REQUEST",
        "First and last name are required",
        400,
      );
    }

    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
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

    const userId = generateId();
    const passwordHash = await bcrypt.hash(password, 12);

    const token = generateInviteToken();
    await createInitialUserAndInvite({
      user: {
        id: userId,
        username: username.toLowerCase(),
        firstName,
        lastName,
        passwordHash,
        avatarColor: randomAvatarColor(),
        role: "admin",
      },
      invite: {
        id: generateId(),
        token,
        createdBy: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const sessionToken = await createSession({
      userId,
      username: username.toLowerCase(),
      sessionVersion: 0,
    });

    const response = NextResponse.json({
      success: true,
      inviteToken: token,
      message: "Account created! Share the invite token with your friends.",
    });

    setSessionCookie(response, sessionToken);

    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return requestBodyErrorResponse(error);
    }
    if (error instanceof InitialSetupAlreadyCompletedError) {
      return apiError("SETUP_COMPLETED", "Setup already completed", 409);
    }
    console.error("Setup error:", error);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
