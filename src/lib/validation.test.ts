import { describe, expect, it } from "vitest";
import {
  accountUpdateSchema,
  addBookSchema,
  isApprovedCoverUrl,
  parseJsonBody,
  RequestBodyError,
  updateBookSchema,
} from "./validation";

describe("cover URL validation", () => {
  it.each([
    "https://books.google.com/books/content?id=abc",
    "https://covers.openlibrary.org/b/isbn/123-L.jpg",
  ])("accepts approved HTTPS URLs", (url) => {
    expect(isApprovedCoverUrl(url)).toBe(true);
  });

  it.each([
    "http://books.google.com/cover.jpg",
    "https://evil.books.google.com/cover.jpg",
    "https://books.google.com.evil.example/cover.jpg",
    "https://user:pass@books.google.com/cover.jpg",
    "javascript:alert(1)",
  ])("rejects unapproved URLs", (url) => {
    expect(isApprovedCoverUrl(url)).toBe(false);
  });
});

describe("strict schemas", () => {
  it("rejects unknown book fields and non-half-star ratings", () => {
    expect(
      addBookSchema.safeParse({
        title: "Book",
        authors: ["Author"],
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(updateBookSchema.safeParse({ rating: 4.7 }).success).toBe(false);
    expect(updateBookSchema.safeParse({ rating: 4.5 }).success).toBe(true);
    expect(
      updateBookSchema.safeParse({ read: true, currentlyReading: true }).success,
    ).toBe(false);
  });

  it("allows current-password verification for username changes", () => {
    expect(
      accountUpdateSchema.safeParse({
        username: "new-username",
        currentPassword: "CurrentPassword1!",
      }).success,
    ).toBe(true);
    expect(
      accountUpdateSchema.safeParse({
        currentPassword: "CurrentPassword1!",
      }).success,
    ).toBe(false);
  });
});

describe("parseJsonBody", () => {
  it("requires JSON and rejects malformed or oversized bodies", async () => {
    const wrongType = new Request("http://localhost", {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "text/plain" },
    });
    await expect(parseJsonBody(wrongType, addBookSchema)).rejects.toMatchObject({
      status: 415,
    } satisfies Partial<RequestBodyError>);

    const malformed = new Request("http://localhost", {
      method: "POST",
      body: "{",
      headers: { "Content-Type": "application/json" },
    });
    await expect(parseJsonBody(malformed, addBookSchema)).rejects.toMatchObject({
      status: 400,
    } satisfies Partial<RequestBodyError>);

    const oversized = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ title: "x".repeat(100), authors: ["A"] }),
      headers: { "Content-Type": "application/json" },
    });
    await expect(parseJsonBody(oversized, addBookSchema, 20)).rejects.toMatchObject({
      status: 413,
    } satisfies Partial<RequestBodyError>);
  });
});
