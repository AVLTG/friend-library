const GOOGLE_BOOKS_ID = /^[A-Za-z0-9_-]{1,50}$/;

function isbn13CheckDigit(firstTwelve: string): number {
  const sum = [...firstTwelve].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return (10 - (sum % 10)) % 10;
}

function isValidIsbn10(value: string): boolean {
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  const sum = [...value].reduce(
    (total, digit, index) =>
      total + (digit === "X" ? 10 : Number(digit)) * (10 - index),
    0,
  );
  return sum % 11 === 0;
}

function isValidIsbn13(value: string): boolean {
  return (
    /^\d{13}$/.test(value) &&
    (value.startsWith("978") || value.startsWith("979")) &&
    isbn13CheckDigit(value.slice(0, 12)) === Number(value[12])
  );
}

export function normalizeIsbn(value: string): string | null {
  const compact = value.replace(/[- \t\n\r\u00a0]/g, "").toUpperCase();
  if (isValidIsbn13(compact)) return compact;
  if (!isValidIsbn10(compact)) return null;

  const firstTwelve = `978${compact.slice(0, 9)}`;
  return `${firstTwelve}${isbn13CheckDigit(firstTwelve)}`;
}

export function normalizeGoogleBooksId(value: string): string | null {
  const normalized = value.trim();
  return GOOGLE_BOOKS_ID.test(normalized) ? normalized : null;
}

export function normalizeDuplicateText(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function findEditionIdentityMatch(
  googleBooksId: string | null,
  isbn: string | null,
  books: Array<{
    id: string;
    googleBooksIds: string[];
    isbn: string | null;
  }>,
): { bookId: string | null; conflict: boolean } {
  const normalizedGoogleId = googleBooksId
    ? normalizeGoogleBooksId(googleBooksId)
    : null;
  const normalizedIsbn = isbn ? normalizeIsbn(isbn) : null;
  const googleMatch = normalizedGoogleId
    ? books.find((book) =>
        book.googleBooksIds.some(
          (candidate) => normalizeGoogleBooksId(candidate) === normalizedGoogleId,
        ),
      )
    : undefined;
  const isbnMatch = normalizedIsbn
    ? books.find(
        (book) => book.isbn && normalizeIsbn(book.isbn) === normalizedIsbn,
      )
    : undefined;
  const conflict = Boolean(
    googleMatch && isbnMatch && googleMatch.id !== isbnMatch.id,
  );

  return {
    bookId: conflict ? null : (googleMatch || isbnMatch)?.id || null,
    conflict,
  };
}
