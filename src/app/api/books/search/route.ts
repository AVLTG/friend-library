import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchBooks } from "@/lib/google-books";
import { sanitizeText } from "@/lib/sanitize";
import { checkRateLimit, SEARCH_LIMIT } from "@/lib/rate-limit";
import { searchQuerySchema } from "@/lib/validation";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { allowed, resetIn } = await checkRateLimit(
      session.userId,
      SEARCH_LIMIT,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many searches. Slow down a bit." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) },
        },
      );
    }
  } catch (error) {
    console.error("Search rate limit error:", error);
    return NextResponse.json(
      { error: "Search is temporarily unavailable" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const queryResult = searchQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!queryResult.success || [...searchParams.keys()].length !== 1) {
    return NextResponse.json({ error: "Invalid search query" }, { status: 400 });
  }
  const query = sanitizeText(queryResult.data.q, 200);

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
