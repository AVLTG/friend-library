import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { count } from "drizzle-orm";

export async function GET() {
  try {
    const userCount = await db.select({ count: count() }).from(users).get();
    return NextResponse.json({
      needsSetup: !userCount || userCount.count === 0,
    });
  } catch {
    // If DB isn't set up yet, needs setup
    return NextResponse.json({ needsSetup: true });
  }
}
