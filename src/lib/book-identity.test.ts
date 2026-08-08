import { describe, expect, it } from "vitest";
import {
  findEditionIdentityMatch,
  normalizeDuplicateText,
  normalizeGoogleBooksId,
  normalizeIsbn,
} from "./book-identity";

describe("book identity normalization", () => {
  it.each([
    ["978-1-4434-1106-6", "9781443411066"],
    [" 978 0 14 044923 5 ", "9780140449235"],
    ["1853260061", "9781853260063"],
    ["142158624x", "9781421586243"],
  ])("canonicalizes %s", (input, expected) => {
    expect(normalizeIsbn(input)).toBe(expected);
  });

  it.each([
    "",
    "1234567890",
    "9781234567890",
    "4006381333931",
    "not-an-isbn",
  ])(
    "rejects invalid ISBN %s",
    (input) => {
      expect(normalizeIsbn(input)).toBeNull();
    },
  );

  it("normalizes provider IDs without accepting arbitrary characters", () => {
    expect(normalizeGoogleBooksId("  Ku0wEGoXp9gC  ")).toBe("Ku0wEGoXp9gC");
    expect(normalizeGoogleBooksId("bad/id")).toBeNull();
  });

  it("keeps Unicode titles meaningful while normalizing equivalent text", () => {
    expect(normalizeDuplicateText("Café 世界")).toBe(
      normalizeDuplicateText("cafe\u0301—世界"),
    );
    expect(normalizeDuplicateText("Преступление и наказание")).not.toBe("");
  });

  it("matches alternate Google aliases and detects split identities", () => {
    const books = [
      {
        id: "book-a",
        googleBooksIds: ["google-a", "google-alias"],
        isbn: "9781443411066",
      },
      {
        id: "book-b",
        googleBooksIds: ["google-b"],
        isbn: "9780062000767",
      },
    ];
    expect(findEditionIdentityMatch("google-alias", null, books)).toEqual({
      bookId: "book-a",
      conflict: false,
    });
    expect(
      findEditionIdentityMatch("google-alias", "9780062000767", books),
    ).toEqual({ bookId: null, conflict: true });
  });
});
