import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookGoogleIds, books, userBooks, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession, generateId, randomSpineColor } from "@/lib/auth";
import {
  BookIdentityConflictError,
  createOrAttachBook,
} from "@/lib/book-write";
import { normalizeGoogleBooksId, normalizeIsbn } from "@/lib/book-identity";
import { toBookDto } from "@/lib/book-dto";
import {
  apiError,
  requestBodyErrorResponse,
  withApiErrorBoundary,
} from "@/lib/api-response";
import { sanitizeText } from "@/lib/sanitize";
import {
  addBookSchema,
  parseJsonBody,
  RequestBodyError,
  safeCoverUrl,
} from "@/lib/validation";

export async function GET() {
  return withApiErrorBoundary(async () => {
  const session = await getSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
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
      const googleAliases = await db
        .select({ googleBooksId: bookGoogleIds.googleBooksId })
        .from(bookGoogleIds)
        .where(eq(bookGoogleIds.bookId, book.id))
        .all();

      return toBookDto(
        book,
        bookUsers,
        session.userId,
        googleAliases.map((alias) => alias.googleBooksId),
      );
    })
  );

    return NextResponse.json(booksWithDetails);
  }, "List books error", "Failed to load books");
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }
    const body = await parseJsonBody(request, addBookSchema, 262_144);
    const title = sanitizeText(body.title, 500);
    const authors = body.authors.map((author) => sanitizeText(author, 200)).filter(Boolean);
    const rawIsbn = body.isbn || "";
    const isbn = rawIsbn ? normalizeIsbn(rawIsbn) : undefined;
    if (rawIsbn && !isbn) {
      return apiError("INVALID_ISBN", "ISBN must be a valid ISBN-10 or ISBN-13", 400);
    }
    const description = body.description ? sanitizeText(body.description, 5000) : undefined;
    const coverUrl = safeCoverUrl(body.coverUrl) || undefined;
    const pageCount = body.pageCount;
    const publishedDate = body.publishedDate ? sanitizeText(body.publishedDate, 20) : undefined;
    const categories = body.categories
      ? body.categories.map((category) => sanitizeText(category, 100)).filter(Boolean)
      : undefined;
    const rawGoogleBooksId = body.googleBooksId
      ? sanitizeText(body.googleBooksId, 50)
      : "";
    const googleBooksId = rawGoogleBooksId
      ? normalizeGoogleBooksId(rawGoogleBooksId)
      : undefined;
    if (rawGoogleBooksId && !googleBooksId) {
      return apiError("INVALID_GOOGLE_BOOKS_ID", "Invalid Google Books ID", 400);
    }

    if (!title || authors.length === 0) {
      return apiError(
        "INVALID_REQUEST",
        "Title and at least one author are required",
        400,
      );
    }

    const bookId = generateId();
    const result = await createOrAttachBook(
      {
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
      },
      {
        id: generateId(),
        userId: session.userId,
        bookId,
        owned: true,
      },
    );

    return NextResponse.json(result, { status: result.bookCreated ? 201 : 200 });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return requestBodyErrorResponse(error);
    }
    if (error instanceof BookIdentityConflictError) {
      return apiError("IDENTITY_CONFLICT", error.message, 409);
    }
    console.error("Add book error:", error);
    return apiError("INTERNAL_ERROR", "Failed to add book", 500);
  }
}
