import { describe, expect, it } from "vitest";
import type { BookDetailDto, RelationshipDto } from "./api-types";
import { reconcileCurrentUserRelationship } from "./book-client-state";

const currentUser = {
  id: "current",
  username: "current",
  firstName: "Current",
  lastName: "Reader",
  avatarColor: "#111111",
};
const otherUser = {
  id: "other",
  username: "other",
  firstName: "Other",
  lastName: "Reader",
  avatarColor: "#222222",
};
const baseRelationship: RelationshipDto = {
  owned: false,
  read: false,
  currentlyReading: false,
  annotated: false,
  rating: null,
  review: null,
  updatedAt: "2026-08-08T12:00:00.000Z",
};
const book: BookDetailDto = {
  id: "book",
  googleBooksId: null,
  googleBooksIds: [],
  title: "Book",
  authors: ["Author"],
  isbn: null,
  description: null,
  coverUrl: null,
  pageCount: null,
  publishedDate: null,
  categories: [],
  spineColor: "#333333",
  addedBy: otherUser.id,
  createdAt: "2026-08-08T10:00:00.000Z",
  owners: [otherUser],
  readers: [],
  annotators: [],
  currentlyReading: [],
  ratings: [
    {
      user: otherUser,
      rating: 2,
      review: "Other review",
      updatedAt: "2026-08-08T11:00:00.000Z",
    },
  ],
  averageRating: 2,
  currentUserBook: null,
  currentUser,
  permissions: {
    canDeleteGlobally: false,
    canRemoveRelationship: false,
  },
};

describe("reconcileCurrentUserRelationship", () => {
  it("updates every derived collection from the authoritative relationship", () => {
    const result = reconcileCurrentUserRelationship(book, {
      ...baseRelationship,
      owned: true,
      currentlyReading: true,
      annotated: true,
      rating: 4,
      review: "Current review",
    });

    expect(result.owners.map((user) => user.id)).toEqual(["other", "current"]);
    expect(result.readers).toEqual([]);
    expect(result.currentlyReading.map((user) => user.id)).toEqual(["current"]);
    expect(result.annotators.map((user) => user.id)).toEqual(["current"]);
    expect(result.ratings).toHaveLength(2);
    expect(result.averageRating).toBe(3);
    expect(result.currentUserBook?.review).toBe("Current review");
    expect(result.permissions.canRemoveRelationship).toBe(true);
  });

  it("replaces an existing rating without changing its position", () => {
    const withCurrentRating = reconcileCurrentUserRelationship(book, {
      ...baseRelationship,
      rating: 4,
    });
    const updated = reconcileCurrentUserRelationship(withCurrentRating, {
      ...baseRelationship,
      rating: 5,
    });

    expect(updated.ratings.map((rating) => rating.user.id)).toEqual([
      "other",
      "current",
    ]);
    expect(updated.ratings[1]?.rating).toBe(5);
    expect(updated.averageRating).toBe(3.5);
  });

  it("removes current-user activity while preserving other users", () => {
    const withActivity = reconcileCurrentUserRelationship(book, {
      ...baseRelationship,
      owned: true,
      read: true,
      rating: 4,
    });
    const removed = reconcileCurrentUserRelationship(withActivity, null);

    expect(removed.owners).toEqual([otherUser]);
    expect(removed.readers).toEqual([]);
    expect(removed.ratings).toEqual(book.ratings);
    expect(removed.averageRating).toBe(2);
    expect(removed.currentUserBook).toBeNull();
    expect(removed.permissions.canRemoveRelationship).toBe(false);
  });
});
