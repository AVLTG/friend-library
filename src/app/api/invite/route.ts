import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inviteTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkRateLimit, INVITE_LIMIT } from "@/lib/rate-limit";
import { createInviteForUser } from "@/lib/invite-token";
import { apiError, withApiErrorBoundary } from "@/lib/api-response";

export async function GET() {
  return withApiErrorBoundary(async () => {
  const session = await getSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const tokens = await db
    .select()
    .from(inviteTokens)
    .where(eq(inviteTokens.createdBy, session.userId))
    .all();

    return NextResponse.json(tokens);
  }, "List invites error", "Failed to load invite tokens");
}

export async function POST() {
  return withApiErrorBoundary(async () => {
  const session = await getSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  try {
    const { allowed, resetIn } = await checkRateLimit(
      session.userId,
      INVITE_LIMIT,
    );
    if (!allowed) {
      return apiError(
        "RATE_LIMITED",
        "Too many invites generated. Try again later.",
        429,
        { "Retry-After": String(Math.ceil(resetIn / 1000)) },
      );
    }
  } catch (error) {
    console.error("Invite rate limit error:", error);
    return apiError(
      "SERVICE_UNAVAILABLE",
      "Invite generation is temporarily unavailable",
      503,
    );
  }

  try {
    return NextResponse.json(await createInviteForUser(session.userId));
  } catch (error) {
    console.error("Invite generation error:", error);
    return apiError(
      "SERVICE_UNAVAILABLE",
      "Invite generation is temporarily unavailable",
      503,
    );
  }
  }, "Create invite request error", "Invite generation is temporarily unavailable");
}
