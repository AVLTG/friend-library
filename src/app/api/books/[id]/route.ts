import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookGoogleIds, books, userBooks, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { authorizeCurrentUser } from "@/lib/authorization";
import {
  apiError,
  requestBodyErrorResponse,
  withApiErrorBoundary,
} from "@/lib/api-response";
import { toBookDetailDto, toRelationshipDto } from "@/lib/book-dto";
import { withSqliteBusyRetry } from "@/lib/db/transaction";
import { sanitizeReview } from "@/lib/sanitize";
import {
  RelationshipBookNotFoundError,
  updateRelationship,
} from "@/lib/relationship-write";
import { RelationshipStateError } from "@/lib/relationship-state";
import {
  generatedIdSchema,
  parseJsonBody,
  RequestBodyError,
  updateBookSchema,
} from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorBoundary(async () => {
  const authorization = await authorizeCurrentUser();
  if (!authorization.ok) {
    return apiError(
      authorization.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      authorization.error,
      authorization.status,
    );
  }

  const { id } = await params;
  if (!generatedIdSchema.safeParse(id).success) {
    return apiError("INVALID_BOOK_ID", "Invalid book ID", 400);
  }

  const book = await db.select().from(books).where(eq(books.id, id)).get();

  if (!book) {
    return apiError("BOOK_NOT_FOUND", "Book not found", 404);
  }

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

    return NextResponse.json(
    toBookDetailDto(
      book,
      bookUsers,
      authorization.user.id,
      authorization.user.role === "admin",
      googleAliases.map((alias) => alias.googleBooksId),
    ),
    );
  }, "Get book error", "Failed to load book");
}

// Update user's relationship with a book
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorBoundary(async () => {
  const authorization = await authorizeCurrentUser();
  if (!authorization.ok) {
    return apiError(
      authorization.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      authorization.error,
      authorization.status,
    );
  }

  const { id } = await params;
  if (!generatedIdSchema.safeParse(id).success) {
    return apiError("INVALID_BOOK_ID", "Invalid book ID", 400);
  }

  let body;
  try {
    body = await parseJsonBody(request, updateBookSchema, 8_192);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return requestBodyErrorResponse(error);
    }
    throw error;
  }

  const { owned, read, currentlyReading, annotated, rating } = body;
  const review =
    body.review === null
      ? null
      : body.review !== undefined
        ? sanitizeReview(body.review)
        : undefined;

  try {
    const userBook = await updateRelationship(authorization.user.id, id, {
      owned,
      read,
      currentlyReading,
      annotated,
      rating,
      review,
    });
    return NextResponse.json(toRelationshipDto(userBook));
  } catch (error) {
    if (error instanceof RelationshipBookNotFoundError) {
      return apiError("BOOK_NOT_FOUND", "Book not found", 404);
    }
    if (error instanceof RelationshipStateError) {
      return apiError(error.code, error.message, 400);
    }
    throw error;
  }
  }, "Update book relationship error", "Failed to update book activity");
}

// Delete a book from the shared library
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorBoundary(async () => {
  const authorization = await authorizeCurrentUser("admin");
  if (!authorization.ok) {
    return apiError(
      authorization.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      authorization.error,
      authorization.status,
    );
  }

  const { id } = await params;
  if (!generatedIdSchema.safeParse(id).success) {
    return apiError("INVALID_BOOK_ID", "Invalid book ID", 400);
  }

  const deletedBook = await withSqliteBusyRetry(() =>
    db.transaction((tx) =>
      tx
        .delete(books)
        .where(eq(books.id, id))
        .returning({ id: books.id })
        .get(),
    ),
  );
  if (!deletedBook) {
    return apiError("BOOK_NOT_FOUND", "Book not found", 404);
  }

    return NextResponse.json({ success: true });
  }, "Delete book error", "Failed to delete book");
}
