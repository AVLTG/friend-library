import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSession, setSessionCookie } from "@/lib/auth";
import { sanitizeText } from "@/lib/sanitize";
import { checkRateLimit, getClientIp, AUTH_LIMIT } from "@/lib/rate-limit";
import { loginSchema, parseJsonBody, RequestBodyError } from "@/lib/validation";
import { apiError, requestBodyErrorResponse } from "@/lib/api-response";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  try {
    const { allowed, resetIn } = await checkRateLimit(ip, AUTH_LIMIT);
    if (!allowed) {
      return apiError(
        "RATE_LIMITED",
        `Too many login attempts. Try again in ${Math.ceil(resetIn / 60000)} minutes.`,
        429,
        { "Retry-After": String(Math.ceil(resetIn / 1000)) },
      );
    }
  } catch (error) {
    console.error("Login rate limit error:", error);
    return apiError(
      "SERVICE_UNAVAILABLE",
      "Login is temporarily unavailable",
      503,
    );
  }

  try {
    const { username, password } = await parseJsonBody(request, loginSchema);

    const cleanUsername = sanitizeText(username, 20).toLowerCase();

    const user = await db
      .select()
      .from(users)
      .where(eq(users.username, cleanUsername))
      .get();

    if (!user) {
      return apiError(
        "INVALID_CREDENTIALS",
        "Invalid username or password",
        401,
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return apiError(
        "INVALID_CREDENTIALS",
        "Invalid username or password",
        401,
      );
    }

    const sessionToken = await createSession({
      userId: user.id,
      username: user.username,
      sessionVersion: user.sessionVersion,
    });

    const response = NextResponse.json({ success: true });
    setSessionCookie(response, sessionToken);

    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return requestBodyErrorResponse(error);
    }
    console.error("Login error:", error);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
