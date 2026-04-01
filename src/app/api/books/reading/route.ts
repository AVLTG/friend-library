import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, userBooks, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    results.map((r) => ({
      book: {
        id: r.book.id,
        title: r.book.title,
        authors: JSON.parse(r.book.authors),
        coverUrl: r.book.coverUrl,
        spineColor: r.book.spineColor,
        pageCount: r.book.pageCount,
      },
      user: {
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        avatarColor: r.user.avatarColor,
      },
    }))
  );
}
