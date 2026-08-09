import { describe, expect, it } from "vitest";
import { classifyBookSearchResults } from "./book-duplicates";

type SearchBook = {
  id: string;
  isbn: string | null;
  title: string;
  authors: string[];
};

type LibraryBook = {
  id: string;
  googleBooksIds: string[];
  isbn: string | null;
  title: string;
  authors: string[];
};

function searchBook(overrides: Partial<SearchBook> = {}): SearchBook {
  return {
    id: "search-id",
    isbn: null,
    title: "A Book Title",
    authors: ["An Author"],
    ...overrides,
  };
}

function libraryBook(overrides: Partial<LibraryBook> = {}): LibraryBook {
  return {
    id: "library-id",
    googleBooksIds: [],
    isbn: null,
    title: "A Book Title",
    authors: ["An Author"],
    ...overrides,
  };
}

function onlyAddable(result: SearchBook, existing: LibraryBook) {
  const classification = classifyBookSearchResults([result], [existing]);
  expect(classification.matchedResults).toEqual([]);
  expect(classification.addableResults).toHaveLength(1);
  return classification.addableResults[0];
}

describe("book search duplicate classification", () => {
  it("normalizes Unicode diacritics and punctuation for advisory matches", () => {
    const addable = onlyAddable(
      searchBook({
        title: "Café Society!",
        authors: ["Gabriel García Márquez"],
      }),
      libraryBook({
        title: "Cafe—Society",
        authors: ["Gabriel Garcia Marquez"],
      }),
    );

    expect(addable.possibleWorkTitle).toBe("Cafe—Society");
  });

  it("enforces the length and character-overlap boundaries", () => {
    const author = ["Shared Author"];
    const atLengthBoundary = onlyAddable(
      searchBook({ title: "abcdefgh", authors: author }),
      libraryBook({ title: "abcdefghij", authors: author }),
    );
    const atCharacterBoundary = onlyAddable(
      searchBook({ title: "abcdefghij", authors: author }),
      libraryBook({ title: "abcdefghik", authors: author }),
    );
    const aboveCharacterBoundary = onlyAddable(
      searchBook({ title: "abcdefghij", authors: author }),
      libraryBook({ title: "abcdefghijx", authors: author }),
    );

    expect(atLengthBoundary.possibleWorkTitle).toBeUndefined();
    expect(atCharacterBoundary.possibleWorkTitle).toBeUndefined();
    expect(aboveCharacterBoundary.possibleWorkTitle).toBe("abcdefghijx");
  });

  it("allows normalized partial author overlap", () => {
    const addable = onlyAddable(
      searchBook({ authors: ["J. R. R. Tolkien"] }),
      libraryBook({ authors: ["Tolkien"] }),
    );

    expect(addable.possibleWorkTitle).toBe("A Book Title");
  });

  it("does not treat Hunger Games as Hunger Games Trilogy", () => {
    const addable = onlyAddable(
      searchBook({ title: "The Hunger Games", authors: ["Suzanne Collins"] }),
      libraryBook({
        title: "The Hunger Games Trilogy",
        authors: ["Suzanne Collins"],
      }),
    );

    expect(addable.possibleWorkTitle).toBeUndefined();
  });

  it("requires author overlap even when titles match", () => {
    const addable = onlyAddable(
      searchBook({ authors: ["Octavia Butler"] }),
      libraryBook({ authors: ["Ursula Le Guin"] }),
    );

    expect(addable.possibleWorkTitle).toBeUndefined();
  });

  it.each([
    ["empty title", { title: "" }, {}],
    ["empty result author", { authors: [""] }, {}],
    ["empty library author", {}, { authors: [""] }],
  ])("does not advise a match for an %s", (_, result, existing) => {
    const addable = onlyAddable(searchBook(result), libraryBook(existing));

    expect(addable.possibleWorkTitle).toBeUndefined();
  });

  it("gives an exact Google Books match precedence over fuzzy advice", () => {
    const result = searchBook({ id: "exact-google-id" });
    const fuzzyBook = libraryBook({ id: "fuzzy-book" });
    const exactBook = libraryBook({
      id: "exact-book",
      googleBooksIds: ["exact-google-id"],
      title: "Different Title",
      authors: ["Different Author"],
    });

    expect(classifyBookSearchResults([result], [fuzzyBook, exactBook])).toEqual({
      matchedResults: [{ ...result, existingBookId: "exact-book" }],
      addableResults: [],
    });
  });

  it("treats a normalized ISBN match as authoritative", () => {
    const result = searchBook({ isbn: "978-1-4434-1106-6" });
    const existing = libraryBook({
      id: "isbn-book",
      isbn: "9781443411066",
      title: "Different Title",
      authors: ["Different Author"],
    });

    expect(classifyBookSearchResults([result], [existing])).toEqual({
      matchedResults: [{ ...result, existingBookId: "isbn-book" }],
      addableResults: [],
    });
  });

  it("keeps conflicting authoritative identities addable and flagged", () => {
    const result = searchBook({
      id: "google-a",
      isbn: "9780062000767",
      title: "Unrelated Result",
      authors: ["Result Author"],
    });
    const googleMatch = libraryBook({
      id: "book-a",
      googleBooksIds: ["google-a"],
      isbn: "9781443411066",
    });
    const isbnMatch = libraryBook({
      id: "book-b",
      googleBooksIds: ["google-b"],
      isbn: "9780062000767",
    });

    expect(
      classifyBookSearchResults([result], [googleMatch, isbnMatch]),
    ).toEqual({
      matchedResults: [],
      addableResults: [{ ...result, identityConflict: true }],
    });
  });

  it("preserves source order within stable matched and addable partitions", () => {
    const results = [
      searchBook({ id: "add-1", title: "Add One" }),
      searchBook({ id: "match-1", title: "Match One" }),
      searchBook({ id: "add-2", title: "Add Two" }),
      searchBook({ id: "match-2", title: "Match Two" }),
    ];
    const existing = [
      libraryBook({ id: "existing-1", googleBooksIds: ["match-1"] }),
      libraryBook({ id: "existing-2", googleBooksIds: ["match-2"] }),
    ];

    const classification = classifyBookSearchResults(results, existing);

    expect(classification.matchedResults.map((book) => book.id)).toEqual([
      "match-1",
      "match-2",
    ]);
    expect(classification.addableResults.map((book) => book.id)).toEqual([
      "add-1",
      "add-2",
    ]);
  });
});
