import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inviteTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession, generateId, generateInviteToken } from "@/lib/auth";
import { checkRateLimit, INVITE_LIMIT } from "@/lib/rate-limit";

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

  const token = generateInviteToken();
  const id = generateId();

  await db.insert(inviteTokens).values({
    id,
    token,
    createdBy: session.userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  return NextResponse.json({ token, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
}
