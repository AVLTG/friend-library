import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, userBooks, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { apiError, withApiErrorBoundary } from "@/lib/api-response";
import { toReadingEntryDto } from "@/lib/book-dto";

export async function GET() {
  return withApiErrorBoundary(async () => {
  const session = await getSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const results = await db
    .select({
      userBook: userBooks,
      book: books,
      user: users,
    })
    .from(userBooks)
    .innerJoin(books, eq(userBooks.bookId, books.id))
    .innerJoin(users, eq(userBooks.userId, users.id))
    .where(eq(userBooks.currentlyReading, true))
    .all();

    return NextResponse.json(
    results.map((result) => toReadingEntryDto(result.book, result.user)),
    );
  }, "Reading list error", "Failed to load current reading activity");
}
