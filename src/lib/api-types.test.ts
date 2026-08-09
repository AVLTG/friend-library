import { describe, expect, it } from "vitest";
import {
  bookDetailResponseSchema,
  createInviteResponseSchema,
  inviteListItemResponseSchema,
  setupSuccessResponseSchema,
} from "./api-types";

describe("API response contracts", () => {
  it("keeps setup success fields in the shared runtime contract", () => {
    expect(
      setupSuccessResponseSchema.parse({
        success: true,
        inviteToken: "ABCDEFGH",
        message: "Account created",
      }),
    ).toEqual({
      success: true,
      inviteToken: "ABCDEFGH",
      message: "Account created",
    });
  });

  it("distinguishes create-invite responses from persisted list rows", () => {
    const created = {
      token: "ABCDEFGH",
      expiresAt: "2026-08-15T10:00:00.000Z",
    };
    const listItem = {
      id: "A12345678901234567890",
      ...created,
      createdBy: "B12345678901234567890",
      usedBy: null,
      usedAt: null,
      createdAt: "2026-08-08T10:00:00.000Z",
    };

    expect(createInviteResponseSchema.parse(created)).toEqual(created);
    expect(inviteListItemResponseSchema.parse(listItem)).toEqual(listItem);
    expect(createInviteResponseSchema.safeParse(listItem).success).toBe(true);
    expect(inviteListItemResponseSchema.safeParse(created).success).toBe(false);
  });

  it("validates nested book detail DTOs including the current user", () => {
    const user = {
      id: "A12345678901234567890",
      username: "reader",
      firstName: "Book",
      lastName: "Reader",
      avatarColor: "#123456",
    };
    const relationship = {
      owned: true,
      read: false,
      currentlyReading: true,
      annotated: false,
      rating: 4.5,
      review: "Excellent",
      updatedAt: "2026-08-08T10:00:00.000Z",
    };
    const detail = {
      id: "B12345678901234567890",
      googleBooksId: "google-id",
      googleBooksIds: ["google-id"],
      title: "Contract Book",
      authors: ["Example Author"],
      isbn: null,
      description: null,
      coverUrl: null,
      pageCount: 320,
      publishedDate: "2026",
      categories: ["Fiction"],
      spineColor: "#654321",
      addedBy: user.id,
      createdAt: "2026-08-08T10:00:00.000Z",
      owners: [user],
      readers: [],
      annotators: [],
      currentlyReading: [user],
      ratings: [
        {
          user,
          rating: 4.5,
          review: "Excellent",
          updatedAt: "2026-08-08T10:00:00.000Z",
        },
      ],
      averageRating: 4.25,
      currentUserBook: relationship,
      currentUser: user,
      permissions: {
        canDeleteGlobally: false,
        canRemoveRelationship: true,
      },
    };

    expect(bookDetailResponseSchema.parse(detail)).toEqual(detail);
  });

  it("accepts additive response fields for rolling deployments", () => {
    expect(
      setupSuccessResponseSchema.safeParse({
        success: true,
        inviteToken: "ABCDEFGH",
        message: "Account created",
        futureField: "ignored by current clients",
      }).success,
    ).toBe(true);
  });
});
