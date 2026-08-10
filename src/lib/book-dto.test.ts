import { describe, expect, it } from "vitest";
import { toBookDetailDto, toReadingEntryDto } from "./book-dto";
import {
  bookDetailResponseSchema,
  booksResponseSchema,
  readingEntriesResponseSchema,
} from "./api-types";
import type { Book, User, UserBook } from "./db/schema";

const now = new Date("2026-08-08T10:00:00.000Z");
const user: User = {
  id: "A12345678901234567890",
  username: "reader",
  firstName: "Book",
  lastName: "Reader",
  passwordHash: "secret",
  avatarColor: "#123456",
  role: "member",
  sessionVersion: 0,
  createdAt: now,
};
const relationship: UserBook = {
  id: "B12345678901234567890",
  userId: user.id,
  bookId: "C12345678901234567890",
  owned: true,
  read: true,
  currentlyReading: false,
  annotated: false,
  rating: 4.5,
  review: "Excellent",
  createdAt: now,
  updatedAt: now,
};
const book: Book = {
  id: relationship.bookId,
  googleBooksId: null,
  title: "DTO Book",
  authors: "not-json",
  isbn: null,
  description: null,
  coverUrl: "https://example.com/unsafe.jpg",
  pageCount: null,
  publishedDate: null,
  categories: null,
  spineColor: "#654321",
  addedBy: user.id,
  createdAt: now,
};

describe("book DTO serialization", () => {
  it("normalizes nullable data and hides internal relationship fields", () => {
    const dto = toBookDetailDto(
      book,
      [{ user, userBook: relationship }],
      user,
      false,
      ["primary-google-id", "alternate-google-id"],
    );

    expect(dto.authors).toEqual([]);
    expect(dto.categories).toEqual([]);
    expect(dto.coverUrl).toBeNull();
    expect(dto.googleBooksIds).toEqual([
      "primary-google-id",
      "alternate-google-id",
    ]);
    expect(dto.createdAt).toBe("2026-08-08T10:00:00.000Z");
    expect(dto.owners[0]).toEqual({
      id: user.id,
      username: "reader",
      firstName: "Book",
      lastName: "Reader",
      avatarColor: "#123456",
    });
    expect(dto.ratings[0]).toMatchObject({
      user: dto.owners[0],
      rating: 4.5,
      review: "Excellent",
      updatedAt: "2026-08-08T10:00:00.000Z",
    });
    expect(dto.currentUserBook).not.toHaveProperty("id");
    expect(dto.currentUserBook).not.toHaveProperty("userId");
    expect(dto.permissions).toEqual({
      canDeleteGlobally: false,
      canRemoveRelationship: true,
    });
  });

  it("normalizes legacy zero page counts to missing metadata", () => {
    const legacyBook = { ...book, pageCount: 0 };
    const detail = toBookDetailDto(
      legacyBook,
      [{ user, userBook: relationship }],
      user,
      false,
    );
    const readingEntry = toReadingEntryDto(legacyBook, user);

    expect(detail.pageCount).toBeNull();
    expect(readingEntry.book.pageCount).toBeNull();
    expect(bookDetailResponseSchema.safeParse(detail).success).toBe(true);
    expect(booksResponseSchema.safeParse([detail]).success).toBe(true);
    expect(readingEntriesResponseSchema.safeParse([readingEntry]).success).toBe(
      true,
    );
  });
});
