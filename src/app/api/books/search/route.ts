import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchBooks } from "@/lib/google-books";
import { sanitizeText } from "@/lib/sanitize";
import { checkRateLimit, SEARCH_LIMIT } from "@/lib/rate-limit";
import { searchQuerySchema } from "@/lib/validation";
import { apiError, withApiErrorBoundary } from "@/lib/api-response";
import { toSearchBookDto } from "@/lib/book-dto";

export async function GET(request: Request) {
  return withApiErrorBoundary(async () => {
  const session = await getSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  try {
    const { allowed, resetIn } = await checkRateLimit(
      session.userId,
      SEARCH_LIMIT,
    );
    if (!allowed) {
      return apiError(
        "RATE_LIMITED",
        "Too many searches. Slow down a bit.",
        429,
        { "Retry-After": String(Math.ceil(resetIn / 1000)) },
      );
    }
  } catch (error) {
    console.error("Search rate limit error:", error);
    return apiError(
      "SERVICE_UNAVAILABLE",
      "Search is temporarily unavailable",
      503,
    );
  }

  const { searchParams } = new URL(request.url);
  const queryResult = searchQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!queryResult.success || [...searchParams.keys()].length !== 1) {
    return apiError("INVALID_REQUEST", "Invalid search query", 400);
  }
  const query = sanitizeText(queryResult.data.q, 200);

  try {
    const results = await searchBooks(query);
    return NextResponse.json(results.map(toSearchBookDto));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Book search error:", message);
    return apiError("UPSTREAM_ERROR", "Failed to search books", 502);
  }
  }, "Book search request error", "Search is temporarily unavailable");
}
