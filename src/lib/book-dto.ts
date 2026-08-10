import type {
  BookDetailDto,
  BookDto,
  BookIdentityDto,
  PublicUserDto,
  ReadingEntryDto,
  RelationshipDto,
  SearchBookDto,
} from "./api-types";
import type { GoogleBookResult } from "./google-books";
import type { Book, User, UserBook } from "./db/schema";
import { safeCoverUrl } from "./validation";

type PublicUser = Pick<
  User,
  "id" | "username" | "firstName" | "lastName" | "avatarColor"
>;
type PublicRelationship = Pick<
  UserBook,
  | "owned"
  | "read"
  | "currentlyReading"
  | "annotated"
  | "rating"
  | "review"
  | "updatedAt"
>;
export type BookUser = {
  userBook: PublicRelationship;
  user: PublicUser;
};

function isoDate(value: Date | number | string): string {
  return new Date(value).toISOString();
}

function stringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function normalizePageCount(value: number | null): number | null {
  return value !== null && Number.isInteger(value) && value > 0 ? value : null;
}

export function toPublicUser(user: PublicUser): PublicUserDto {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarColor: user.avatarColor,
  };
}

export function toRelationshipDto(
  relationship: Pick<
    UserBook,
    | "owned"
    | "read"
    | "currentlyReading"
    | "annotated"
    | "rating"
    | "review"
    | "updatedAt"
  >,
): RelationshipDto {
  return {
    owned: relationship.owned,
    read: relationship.read,
    currentlyReading: relationship.currentlyReading,
    annotated: relationship.annotated,
    rating: relationship.rating,
    review: relationship.review,
    updatedAt: isoDate(relationship.updatedAt),
  };
}

export function toBookDto(
  book: Book,
  bookUsers: BookUser[],
  currentUserId: string,
  googleBooksIds: string[] = book.googleBooksId ? [book.googleBooksId] : [],
): BookDto {
  const publicUsers = (predicate: (entry: BookUser) => boolean) =>
    bookUsers.filter(predicate).map(({ user }) => toPublicUser(user));
  const rated = bookUsers.filter(
    (entry): entry is BookUser & {
      userBook: PublicRelationship & { rating: number };
    } =>
      entry.userBook.rating !== null,
  );
  const current = bookUsers.find((entry) => entry.user.id === currentUserId);

  return {
    id: book.id,
    googleBooksId: book.googleBooksId,
    googleBooksIds,
    title: book.title,
    authors: stringArray(book.authors),
    isbn: book.isbn,
    description: book.description,
    coverUrl: safeCoverUrl(book.coverUrl),
    pageCount: normalizePageCount(book.pageCount),
    publishedDate: book.publishedDate,
    categories: stringArray(book.categories),
    spineColor: book.spineColor,
    addedBy: book.addedBy,
    createdAt: isoDate(book.createdAt),
    owners: publicUsers(({ userBook }) => userBook.owned),
    readers: publicUsers(({ userBook }) => userBook.read),
    annotators: publicUsers(({ userBook }) => userBook.annotated),
    currentlyReading: publicUsers(({ userBook }) => userBook.currentlyReading),
    ratings: rated.map(({ userBook, user }) => ({
      user: toPublicUser(user),
      rating: userBook.rating,
      review: userBook.review,
      updatedAt: isoDate(userBook.updatedAt),
    })),
    averageRating:
      rated.length > 0
        ? rated.reduce((sum, entry) => sum + entry.userBook.rating, 0) /
          rated.length
        : null,
    currentUserBook: current ? toRelationshipDto(current.userBook) : null,
  };
}

export function toBookIdentityDto(
  book: Pick<Book, "id" | "title" | "authors" | "isbn">,
  googleBooksIds: string[],
): BookIdentityDto {
  return {
    id: book.id,
    googleBooksIds,
    isbn: book.isbn,
    title: book.title,
    authors: stringArray(book.authors),
  };
}

export function toBookDetailDto(
  book: Book,
  bookUsers: BookUser[],
  currentUser: PublicUser,
  canDeleteGlobally: boolean,
  googleBooksIds?: string[],
): BookDetailDto {
  const dto = toBookDto(book, bookUsers, currentUser.id, googleBooksIds);
  return {
    ...dto,
    currentUser: toPublicUser(currentUser),
    permissions: {
      canDeleteGlobally,
      canRemoveRelationship: dto.currentUserBook !== null,
    },
  };
}

export function toSearchBookDto(book: GoogleBookResult): SearchBookDto {
  return {
    id: book.id,
    title: book.title,
    authors: book.authors,
    description: book.description ?? null,
    isbn: book.isbn ?? null,
    coverUrl: safeCoverUrl(book.coverUrl),
    pageCount: book.pageCount ?? null,
    publishedDate: book.publishedDate ?? null,
    categories: book.categories ?? [],
  };
}

export function toReadingEntryDto(
  book: Book,
  user: User,
): ReadingEntryDto {
  return {
    book: {
      id: book.id,
      title: book.title,
      authors: stringArray(book.authors),
      coverUrl: safeCoverUrl(book.coverUrl),
      spineColor: book.spineColor,
      pageCount: normalizePageCount(book.pageCount),
    },
    user: toPublicUser(user),
  };
}
