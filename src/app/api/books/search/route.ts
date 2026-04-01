import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchBooks } from "@/lib/google-books";
import { sanitizeText } from "@/lib/sanitize";
import { checkRateLimit, getClientIp, SEARCH_LIMIT } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const { allowed } = checkRateLimit(ip, SEARCH_LIMIT);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many searches. Slow down a bit." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q");
  const query = rawQuery ? sanitizeText(rawQuery, 200) : "";

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  try {
    const results = await searchBooks(query);
    return NextResponse.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Book search error:", message);
    return NextResponse.json(
      { error: "Failed to search books", detail: message },
      { status: 500 }
    );
  }
}
