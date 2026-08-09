import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type {
  BookDetailDto,
  BookDto,
  BookIdentityDto,
  PublicUserDto,
} from "./api-types";
import {
  toBookDetailDto,
  toBookDto,
  toBookIdentityDto,
  type BookUser,
} from "./book-dto";
import { db } from "./db";
import * as schema from "./db/schema";
import { bookGoogleIds, books, userBooks, users } from "./db/schema";

type Database = LibSQLDatabase<typeof schema>;

const bookProjection = {
  id: books.id,
  googleBooksId: books.googleBooksId,
  title: books.title,
  authors: books.authors,
  isbn: books.isbn,
  description: books.description,
  coverUrl: books.coverUrl,
  pageCount: books.pageCount,
  publishedDate: books.publishedDate,
  categories: books.categories,
  spineColor: books.spineColor,
  addedBy: books.addedBy,
  createdAt: books.createdAt,
};

const relationshipProjection = {
  bookId: userBooks.bookId,
  userBook: {
    owned: userBooks.owned,
    read: userBooks.read,
    currentlyReading: userBooks.currentlyReading,
    annotated: userBooks.annotated,
    rating: userBooks.rating,
    review: userBooks.review,
    updatedAt: userBooks.updatedAt,
  },
  user: {
    id: users.id,
    username: users.username,
    firstName: users.firstName,
    lastName: users.lastName,
    avatarColor: users.avatarColor,
  },
};

const aliasProjection = {
  bookId: bookGoogleIds.bookId,
  googleBooksId: bookGoogleIds.googleBooksId,
};

const identityProjection = {
  id: books.id,
  title: books.title,
  authors: books.authors,
  isbn: books.isbn,
};

async function loadBookAggregates(database: Database, bookId?: string) {
  const bookQuery = database.select(bookProjection).from(books);
  const relationshipQuery = database
    .select(relationshipProjection)
    .from(userBooks)
    .innerJoin(users, eq(userBooks.userId, users.id));
  const aliasQuery = database.select(aliasProjection).from(bookGoogleIds);

  // A libSQL batch keeps the aggregate reads on one database snapshot.
  const [bookRows, relationshipRows, aliasRows] = bookId
    ? await database.batch([
        bookQuery.where(eq(books.id, bookId)),
        relationshipQuery.where(eq(userBooks.bookId, bookId)),
        aliasQuery.where(eq(bookGoogleIds.bookId, bookId)),
      ])
    : await database.batch([bookQuery, relationshipQuery, aliasQuery]);

  const relationshipsByBook = new Map<string, BookUser[]>();
  for (const { bookId: relationshipBookId, userBook, user } of relationshipRows) {
    const relationships = relationshipsByBook.get(relationshipBookId) ?? [];
    relationships.push({ userBook, user });
    relationshipsByBook.set(relationshipBookId, relationships);
  }

  const aliasesByBook = new Map<string, string[]>();
  for (const alias of aliasRows) {
    const aliases = aliasesByBook.get(alias.bookId) ?? [];
    aliases.push(alias.googleBooksId);
    aliasesByBook.set(alias.bookId, aliases);
  }

  return bookRows.map((book) => ({
    book,
    bookUsers: relationshipsByBook.get(book.id) ?? [],
    googleBooksIds: aliasesByBook.get(book.id) ?? [],
  }));
}

export async function readBooks(
  currentUserId: string,
  database: Database = db,
): Promise<BookDto[]> {
  const aggregates = await loadBookAggregates(database);
  return aggregates.map(({ book, bookUsers, googleBooksIds }) =>
    toBookDto(book, bookUsers, currentUserId, googleBooksIds),
  );
}

export async function readBookIdentities(
  database: Database = db,
): Promise<BookIdentityDto[]> {
  const [bookRows, aliasRows] = await database.batch([
    database.select(identityProjection).from(books),
    database.select(aliasProjection).from(bookGoogleIds),
  ]);
  const aliasesByBook = new Map<string, string[]>();
  for (const alias of aliasRows) {
    const aliases = aliasesByBook.get(alias.bookId) ?? [];
    aliases.push(alias.googleBooksId);
    aliasesByBook.set(alias.bookId, aliases);
  }

  return bookRows.map((book) =>
    toBookIdentityDto(book, aliasesByBook.get(book.id) ?? []),
  );
}

export async function readBookDetail(
  bookId: string,
  currentUser: PublicUserDto,
  canDeleteGlobally: boolean,
  database: Database = db,
): Promise<BookDetailDto | null> {
  const [aggregate] = await loadBookAggregates(database, bookId);
  if (!aggregate) return null;

  return toBookDetailDto(
    aggregate.book,
    aggregate.bookUsers,
    currentUser,
    canDeleteGlobally,
    aggregate.googleBooksIds,
  );
}
