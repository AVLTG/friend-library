import { afterEach, describe, expect, it, vi } from "vitest";
import { getBookById, searchBooks } from "./google-books";

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
              {
                id: "edge-case-id",
                volumeInfo: {
                  title: "Edge Case",
                  authors: [],
                  pageCount: 100000,
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const [book, edgeCase] = await searchBooks("test");
    expect(book.title).toHaveLength(500);
    expect(book.authors).toHaveLength(20);
    expect(book.authors[0]).toHaveLength(200);
    expect(book.description).toHaveLength(5000);
    expect(book.publishedDate).toHaveLength(20);
    expect(book.categories).toHaveLength(50);
    expect(book.categories?.[0]).toHaveLength(100);
    expect(edgeCase.authors).toEqual(["Unknown Author"]);
    expect(edgeCase.pageCount).toBeUndefined();
  });

  it("prefers a valid ISBN-13 and keeps a usable Google cover", async () => {
    vi.stubEnv("GOOGLE_BOOKS_API_KEY", "");
    const volume = {
      id: "google-id",
      volumeInfo: {
        title: "Edition",
        authors: ["Author"],
        industryIdentifiers: [
          { type: "ISBN_10", identifier: "1853260061" },
          { type: "ISBN_13", identifier: "9781443411066" },
        ],
        imageLinks: {
          thumbnail: "http://books.google.com/books/content?id=abc&edge=curl&zoom=1",
        },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [volume] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const [book] = await searchBooks("edition");
    expect(book.isbn).toBe("9781443411066");
    expect(book.coverUrl).toBe(
      "https://books.google.com/books/content?id=abc&zoom=3",
    );
  });

  it("uses the same normalization for search and by-ID results", async () => {
    vi.stubEnv("GOOGLE_BOOKS_API_KEY", "");
    const volume = {
      id: "same-id",
      volumeInfo: {
        title: "Same Edition",
        authors: ["Author"],
        industryIdentifiers: [{ type: "ISBN_10", identifier: "142158624X" }],
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [volume] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(volume), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const [searched] = await searchBooks("same");
    const fetched = await getBookById("same-id");
    expect(fetched).toEqual(searched);
    expect(fetched?.isbn).toBe("9781421586243");
    expect(fetched?.coverUrl).toBeUndefined();
  });

  it("skips malformed volumes without failing valid results", async () => {
    vi.stubEnv("GOOGLE_BOOKS_API_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              { id: "missing-title", volumeInfo: {} },
              {
                id: "valid-id",
                volumeInfo: {
                  title: "Valid Book",
                  authors: [42, "Valid Author"],
                  categories: [{ bad: true }, "Fiction"],
                  pageCount: "320",
                  industryIdentifiers: [
                    { type: "ISBN_13", identifier: 9781443411066 },
                    { type: "ISBN_13", identifier: "9781443411066" },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(searchBooks("valid")).resolves.toEqual([
      expect.objectContaining({
        id: "valid-id",
        authors: ["Valid Author"],
        categories: ["Fiction"],
        pageCount: undefined,
        isbn: "9781443411066",
      }),
    ]);
  });

  it("falls back to Unknown Author after sanitizing blank names", async () => {
    vi.stubEnv("GOOGLE_BOOKS_API_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "blank-author",
                volumeInfo: { title: "Anonymous", authors: ["   "] },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(searchBooks("anonymous")).resolves.toEqual([
      expect.objectContaining({ authors: ["Unknown Author"] }),
    ]);
  });
});
