import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inviteTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { checkRateLimit, INVITE_LIMIT } from "@/lib/rate-limit";
import { createInviteForUser } from "@/lib/invite-token";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await db
    .select()
    .from(inviteTokens)
    .where(eq(inviteTokens.createdBy, session.userId))
    .all();

  return NextResponse.json(tokens);
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { allowed, resetIn } = await checkRateLimit(
      session.userId,
      INVITE_LIMIT,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many invites generated. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) },
        },
      );
    }
  } catch (error) {
    console.error("Invite rate limit error:", error);
    return NextResponse.json(
      { error: "Invite generation is temporarily unavailable" },
      { status: 503 },
    );
  }

  try {
    return NextResponse.json(await createInviteForUser(session.userId));
  } catch (error) {
    console.error("Invite generation error:", error);
    return NextResponse.json(
      { error: "Invite generation is temporarily unavailable" },
      { status: 503 },
    );
  }
}
