import { afterEach, describe, expect, it, vi } from "vitest";
import { searchBooks } from "./google-books";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Google Books normalization", () => {
  it("bounds upstream metadata to the add-book API limits", async () => {
    vi.stubEnv("GOOGLE_BOOKS_API_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "google-id",
                volumeInfo: {
                  title: "T".repeat(600),
                  authors: Array.from({ length: 25 }, () => "A".repeat(250)),
                  description: "D".repeat(6000),
                  publishedDate: "P".repeat(30),
                  categories: Array.from({ length: 60 }, () => "C".repeat(120)),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const [book] = await searchBooks("test");
    expect(book.title).toHaveLength(500);
    expect(book.authors).toHaveLength(20);
    expect(book.authors[0]).toHaveLength(200);
    expect(book.description).toHaveLength(5000);
    expect(book.publishedDate).toHaveLength(20);
    expect(book.categories).toHaveLength(50);
    expect(book.categories?.[0]).toHaveLength(100);
  });
});
