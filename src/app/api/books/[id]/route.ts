import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, userBooks, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession, generateId } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

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
      bookUsers.find((ub) => ub.user.id === session.userId)?.userBook || null,
  });
}

// Update user's relationship with a book
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { owned, read, annotated, rating, review } = body;

  const book = await db.select().from(books).where(eq(books.id, id)).get();
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  // Find or create user_book entry
  let userBook = await db
    .select()
    .from(userBooks)
    .where(
      and(eq(userBooks.userId, session.userId), eq(userBooks.bookId, id))
    )
    .get();

  if (!userBook) {
    const newId = generateId();
    await db.insert(userBooks).values({
      id: newId,
      userId: session.userId,
      bookId: id,
      owned: owned ?? false,
      read: read ?? false,
      annotated: annotated ?? false,
      rating: rating ?? null,
      review: review ?? null,
    });
    userBook = await db
      .select()
      .from(userBooks)
      .where(eq(userBooks.id, newId))
      .get();
  } else {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (owned !== undefined) updates.owned = owned;
    if (read !== undefined) updates.read = read;
    if (annotated !== undefined) updates.annotated = annotated;
    if (rating !== undefined) updates.rating = rating;
    if (review !== undefined) updates.review = review;

    await db
      .update(userBooks)
      .set(updates)
      .where(eq(userBooks.id, userBook.id));

    userBook = await db
      .select()
      .from(userBooks)
      .where(eq(userBooks.id, userBook.id))
      .get();
  }

  return NextResponse.json(userBook);
}

// Delete a book from the shared library
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const book = await db.select().from(books).where(eq(books.id, id)).get();
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  // Delete all user_book relationships first, then the book
  await db.delete(userBooks).where(eq(userBooks.bookId, id));
  await db.delete(books).where(eq(books.id, id));

  return NextResponse.json({ success: true });
}
