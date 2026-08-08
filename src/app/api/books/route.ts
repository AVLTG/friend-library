import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, userBooks, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession, generateId, randomSpineColor } from "@/lib/auth";
import { sanitizeText } from "@/lib/sanitize";
import {
  addBookSchema,
  parseJsonBody,
  RequestBodyError,
  safeCoverUrl,
} from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allBooks = await db.select().from(books).all();

  // Get user_books data for each book
  const booksWithDetails = await Promise.all(
    allBooks.map(async (book) => {
      const bookUsers = await db
        .select({
          userBook: userBooks,
          user: users,
        })
        .from(userBooks)
        .innerJoin(users, eq(userBooks.userId, users.id))
        .where(eq(userBooks.bookId, book.id))
        .all();

      return {
        ...book,
        coverUrl: safeCoverUrl(book.coverUrl),
        authors: JSON.parse(book.authors),
        categories: book.categories ? JSON.parse(book.categories) : [],
        owners: bookUsers
          .filter((ub) => ub.userBook.owned)
          .map((ub) => ({
            id: ub.user.id,
            username: ub.user.username,
            firstName: ub.user.firstName,
            avatarColor: ub.user.avatarColor,
          })),
        readers: bookUsers
          .filter((ub) => ub.userBook.read)
          .map((ub) => ({
            id: ub.user.id,
            username: ub.user.username,
            firstName: ub.user.firstName,
            avatarColor: ub.user.avatarColor,
          })),
        annotators: bookUsers
          .filter((ub) => ub.userBook.annotated)
          .map((ub) => ({
            id: ub.user.id,
            username: ub.user.username,
            firstName: ub.user.firstName,
            avatarColor: ub.user.avatarColor,
          })),
        currentlyReading: bookUsers
          .filter((ub) => ub.userBook.currentlyReading)
          .map((ub) => ({
            id: ub.user.id,
            username: ub.user.username,
            firstName: ub.user.firstName,
            avatarColor: ub.user.avatarColor,
          })),
        ratings: bookUsers
          .filter((ub) => ub.userBook.rating !== null)
          .map((ub) => ({
            userId: ub.user.id,
            username: ub.user.username,
            firstName: ub.user.firstName,
            avatarColor: ub.user.avatarColor,
            rating: ub.userBook.rating,
            review: ub.userBook.review,
          })),
        averageRating:
          bookUsers.filter((ub) => ub.userBook.rating !== null).length > 0
            ? bookUsers
                .filter((ub) => ub.userBook.rating !== null)
                .reduce((sum, ub) => sum + (ub.userBook.rating || 0), 0) /
              bookUsers.filter((ub) => ub.userBook.rating !== null).length
            : null,
        currentUserBook: bookUsers.find(
          (ub) => ub.user.id === session.userId
        )?.userBook || null,
      };
    })
  );

  return NextResponse.json(booksWithDetails);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await parseJsonBody(request, addBookSchema, 16_384);
    const title = sanitizeText(body.title, 500);
    const authors = body.authors.map((author) => sanitizeText(author, 200)).filter(Boolean);
    const isbn = body.isbn ? sanitizeText(body.isbn, 20) : undefined;
    const description = body.description ? sanitizeText(body.description, 5000) : undefined;
    const coverUrl = safeCoverUrl(body.coverUrl) || undefined;
    const pageCount = body.pageCount;
    const publishedDate = body.publishedDate ? sanitizeText(body.publishedDate, 20) : undefined;
    const categories = body.categories
      ? body.categories.map((category) => sanitizeText(category, 100)).filter(Boolean)
      : undefined;
    const googleBooksId = body.googleBooksId ? sanitizeText(body.googleBooksId, 50) : undefined;

    if (!title || authors.length === 0) {
      return NextResponse.json(
        { error: "Title and at least one author are required" },
        { status: 400 }
      );
    }

    // Check if book already exists (by Google Books ID or ISBN)
    if (googleBooksId) {
      const existing = await db
        .select()
        .from(books)
        .where(eq(books.googleBooksId, googleBooksId))
        .get();

      if (existing) {
        // Book exists, just add user relationship
        const existingUserBook = await db
          .select()
          .from(userBooks)
          .where(eq(userBooks.bookId, existing.id))
          .all();

        const alreadyLinked = existingUserBook.find(
          (ub) => ub.userId === session.userId
        );

        if (!alreadyLinked) {
          await db.insert(userBooks).values({
            id: generateId(),
            userId: session.userId,
            bookId: existing.id,
            owned: true,
          });
        }

        return NextResponse.json({ bookId: existing.id, alreadyExisted: true });
      }
    }

    const bookId = generateId();
    await db.insert(books).values({
      id: bookId,
      googleBooksId,
      title,
      authors: JSON.stringify(authors),
      isbn,
      description,
      coverUrl,
      pageCount,
      publishedDate,
      categories: categories ? JSON.stringify(categories) : null,
      spineColor: randomSpineColor(),
      addedBy: session.userId,
    });

    // Create user_book entry (owner)
    await db.insert(userBooks).values({
      id: generateId(),
      userId: session.userId,
      bookId,
      owned: true,
    });

    return NextResponse.json({ bookId, alreadyExisted: false });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Add book error:", error);
    return NextResponse.json(
      { error: "Failed to add book" },
      { status: 500 }
    );
  }
}
