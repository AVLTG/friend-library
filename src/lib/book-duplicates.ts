import {
  findEditionIdentityMatch,
  normalizeDuplicateText,
} from "./book-identity";

type SearchBookIdentity = {
  id: string;
  isbn: string | null;
  title: string;
  authors: readonly string[];
};

type LibraryBookIdentity = {
  id: string;
  googleBooksIds: readonly string[];
  isbn: string | null;
  title: string;
  authors: readonly string[];
};

export type MatchedBookSearchResult<T extends SearchBookIdentity> = T & {
  existingBookId: string;
};

export type AddableBookSearchResult<T extends SearchBookIdentity> = T & {
  possibleWorkTitle?: string;
  identityConflict?: true;
};

export type BookSearchClassification<T extends SearchBookIdentity> = {
  matchedResults: MatchedBookSearchResult<T>[];
  addableResults: AddableBookSearchResult<T>[];
};

function titlesAreSimilar(a: string, b: string): boolean {
  const normalizedA = normalizeDuplicateText(a);
  const normalizedB = normalizeDuplicateText(b);
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;

  const aChars = [...normalizedA];
  const bChars = [...normalizedB];
  const longer = aChars.length > bChars.length ? aChars : bChars;
  const shorter = aChars.length > bChars.length ? bChars : aChars;
  if (shorter.length / longer.length < 0.8) return false;

  let matches = 0;
  const unmatched = [...longer];
  for (const character of shorter) {
    const index = unmatched.indexOf(character);
    if (index !== -1) {
      matches++;
      unmatched.splice(index, 1);
    }
  }
  return matches / longer.length > 0.9;
}

function isPossibleWorkMatch(
  result: SearchBookIdentity,
  existing: LibraryBookIdentity,
): boolean {
  if (!titlesAreSimilar(result.title, existing.title)) return false;

  const resultAuthors = result.authors
    .map(normalizeDuplicateText)
    .filter(Boolean);
  const existingAuthors = existing.authors
    .map(normalizeDuplicateText)
    .filter(Boolean);
  return resultAuthors.some((resultAuthor) =>
    existingAuthors.some(
      (existingAuthor) =>
        resultAuthor === existingAuthor ||
        resultAuthor.includes(existingAuthor) ||
        existingAuthor.includes(resultAuthor),
    ),
  );
}

export function classifyBookSearchResults<T extends SearchBookIdentity>(
  results: readonly T[],
  existingBooks: readonly LibraryBookIdentity[],
): BookSearchClassification<T> {
  const matchedResults: MatchedBookSearchResult<T>[] = [];
  const addableResults: AddableBookSearchResult<T>[] = [];

  for (const result of results) {
    const { bookId, conflict } = findEditionIdentityMatch(
      result.id,
      result.isbn,
      existingBooks,
    );
    if (bookId && !conflict) {
      matchedResults.push({ ...result, existingBookId: bookId });
      continue;
    }

    const possibleWork = existingBooks.find((book) =>
      isPossibleWorkMatch(result, book),
    );
    addableResults.push({
      ...result,
      ...(conflict ? { identityConflict: true as const } : {}),
      ...(possibleWork ? { possibleWorkTitle: possibleWork.title } : {}),
    });
  }

  return { matchedResults, addableResults };
}
