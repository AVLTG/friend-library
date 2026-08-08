import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSession, setSessionCookie } from "@/lib/auth";
import { sanitizeText } from "@/lib/sanitize";
import { checkRateLimit, getClientIp, AUTH_LIMIT } from "@/lib/rate-limit";
import { loginSchema, parseJsonBody, RequestBodyError } from "@/lib/validation";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  try {
    const { allowed, resetIn } = await checkRateLimit(ip, AUTH_LIMIT);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${Math.ceil(resetIn / 60000)} minutes.` },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) },
        },
      );
    }
  } catch (error) {
    console.error("Login rate limit error:", error);
    return NextResponse.json(
      { error: "Login is temporarily unavailable" },
      { status: 503 },
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
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
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
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
