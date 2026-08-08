import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, userBooks, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/auth";
import { authorizeCurrentUser } from "@/lib/authorization";
import { withSqliteBusyRetry } from "@/lib/db/transaction";
import { sanitizeReview } from "@/lib/sanitize";
import {
  generatedIdSchema,
  parseJsonBody,
  RequestBodyError,
  safeCoverUrl,
  updateBookSchema,
} from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authorization = await authorizeCurrentUser();
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }

  const { id } = await params;
  if (!generatedIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid book ID" }, { status: 400 });
  }

  const book = await db.select().from(books).where(eq(books.id, id)).get();

  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
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

  return NextResponse.json({
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
        lastName: ub.user.lastName,
        avatarColor: ub.user.avatarColor,
      })),
    readers: bookUsers
      .filter((ub) => ub.userBook.read)
      .map((ub) => ({
        id: ub.user.id,
        username: ub.user.username,
        firstName: ub.user.firstName,
        lastName: ub.user.lastName,
        avatarColor: ub.user.avatarColor,
      })),
    annotators: bookUsers
      .filter((ub) => ub.userBook.annotated)
      .map((ub) => ({
        id: ub.user.id,
        username: ub.user.username,
        firstName: ub.user.firstName,
        lastName: ub.user.lastName,
        avatarColor: ub.user.avatarColor,
      })),
    currentlyReading: bookUsers
      .filter((ub) => ub.userBook.currentlyReading)
      .map((ub) => ({
        id: ub.user.id,
        username: ub.user.username,
        firstName: ub.user.firstName,
        lastName: ub.user.lastName,
        avatarColor: ub.user.avatarColor,
      })),
    ratings: bookUsers
      .filter((ub) => ub.userBook.rating !== null)
      .map((ub) => ({
        userId: ub.user.id,
        username: ub.user.username,
        firstName: ub.user.firstName,
        lastName: ub.user.lastName,
        avatarColor: ub.user.avatarColor,
        rating: ub.userBook.rating,
        review: ub.userBook.review,
        updatedAt: ub.userBook.updatedAt,
      })),
    averageRating:
      bookUsers.filter((ub) => ub.userBook.rating !== null).length > 0
        ? bookUsers
            .filter((ub) => ub.userBook.rating !== null)
            .reduce((sum, ub) => sum + (ub.userBook.rating || 0), 0) /
          bookUsers.filter((ub) => ub.userBook.rating !== null).length
        : null,
    currentUserBook:
      bookUsers.find((ub) => ub.user.id === authorization.user.id)?.userBook || null,
    permissions: {
      canDeleteGlobally: authorization.user.role === "admin",
      canRemoveRelationship: bookUsers.some(
        (ub) => ub.user.id === authorization.user.id,
      ),
    },
  });
}

// Update user's relationship with a book
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authorization = await authorizeCurrentUser();
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }

  const { id } = await params;
  if (!generatedIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid book ID" }, { status: 400 });
  }

  let body;
  try {
    body = await parseJsonBody(request, updateBookSchema, 8_192);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
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

  const book = await db.select().from(books).where(eq(books.id, id)).get();
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const updates: Partial<typeof userBooks.$inferInsert> = { updatedAt: new Date() };
  if (owned !== undefined) updates.owned = owned;
  if (annotated !== undefined) updates.annotated = annotated;
  if (rating !== undefined) updates.rating = rating;
  if (review !== undefined) updates.review = review;

  if (currentlyReading !== undefined) {
    updates.currentlyReading = currentlyReading;
    if (currentlyReading) updates.read = false;
  }
  if (read !== undefined) {
    updates.read = read;
    if (read) updates.currentlyReading = false;
  }

  const initialRead = read ?? false;
  const initialCurrentlyReading = initialRead ? false : (currentlyReading ?? false);
  await db
    .insert(userBooks)
    .values({
      id: generateId(),
      userId: authorization.user.id,
      bookId: id,
      owned: owned ?? false,
      read: initialRead,
      currentlyReading: initialCurrentlyReading,
      annotated: annotated ?? false,
      rating: rating ?? null,
      review: review ?? null,
    })
    .onConflictDoUpdate({
      target: [userBooks.userId, userBooks.bookId],
      set: updates,
    });

  const userBook = await db
    .select()
    .from(userBooks)
    .where(
      and(
        eq(userBooks.userId, authorization.user.id),
        eq(userBooks.bookId, id),
      ),
    )
    .get();

  return NextResponse.json(userBook);
}

// Delete a book from the shared library
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authorization = await authorizeCurrentUser("admin");
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }

  const { id } = await params;
  if (!generatedIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid book ID" }, { status: 400 });
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
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
