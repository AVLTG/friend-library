import { getGoogleBooksApiKey } from "./env";
import { normalizeGoogleBooksId, normalizeIsbn } from "./book-identity";
import { sanitizeText } from "./sanitize";
import { safeCoverUrl } from "./validation";

function truncate(value: string | undefined, maxLength: number) {
  return value?.slice(0, maxLength);
}

function normalizeAuthors(authors: unknown): string[] {
  const validAuthors = Array.isArray(authors)
    ? authors.filter((author): author is string => typeof author === "string")
    : [];
  const sanitized = validAuthors
    .slice(0, 20)
    .map((author) => sanitizeText(author, 200))
    .filter(Boolean);
  return sanitized.length ? sanitized : ["Unknown Author"];
}

function normalizeCategories(categories: unknown) {
  if (!Array.isArray(categories)) return undefined;
  return categories
    .filter((category): category is string => typeof category === "string")
    .slice(0, 50)
    .map((category) => sanitizeText(category, 100))
    .filter(Boolean);
}

export interface GoogleBookResult {
  id: string;
  title: string;
  authors: string[];
  description?: string;
  isbn?: string;
  coverUrl?: string;
  pageCount?: number;
  publishedDate?: string;
  categories?: string[];
}

interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    pageCount?: number;
    publishedDate?: string;
    categories?: string[];
  };
}

function normalizeVolume(item: unknown): GoogleBookResult | null {
  if (!item || typeof item !== "object") return null;
  const rawItem = item as Partial<GoogleBooksVolume>;
  if (typeof rawItem.id !== "string") return null;
  const id = normalizeGoogleBooksId(rawItem.id);
  const info = rawItem.volumeInfo;
  if (!info || typeof info !== "object") return null;
  const title = typeof info.title === "string" ? sanitizeText(info.title, 500) : "";
  if (!id || !title) return null;

  const identifiers = Array.isArray(info.industryIdentifiers)
    ? info.industryIdentifiers.filter(
        (entry): entry is { type: string; identifier: string } =>
          Boolean(
            entry &&
              typeof entry.type === "string" &&
              typeof entry.identifier === "string",
          ),
      )
    : [];
  const isbn =
    identifiers
      .filter((entry) => entry.type === "ISBN_13")
      .map((entry) => normalizeIsbn(entry.identifier))
      .find((value) => value !== null) ||
    identifiers
      .filter((entry) => entry.type === "ISBN_10")
      .map((entry) => normalizeIsbn(entry.identifier))
      .find((value) => value !== null) ||
    undefined;

  let coverUrl =
    typeof info.imageLinks?.thumbnail === "string"
      ? info.imageLinks.thumbnail
      : typeof info.imageLinks?.smallThumbnail === "string"
        ? info.imageLinks.smallThumbnail
        : undefined;
  if (coverUrl) {
    coverUrl = coverUrl
      .replace("http://", "https://")
      .replace(/&?edge=curl/g, "")
      .replace(/zoom=\d/, "zoom=3");
  }

  return {
    id,
    title,
    authors: normalizeAuthors(info.authors),
    description: truncate(
      typeof info.description === "string" ? info.description : undefined,
      5000,
    ),
    isbn,
    coverUrl: safeCoverUrl(coverUrl) || undefined,
    pageCount:
      typeof info.pageCount === "number" &&
      Number.isInteger(info.pageCount) &&
      info.pageCount > 0 &&
      info.pageCount <= 99999
        ? info.pageCount
        : undefined,
    publishedDate: truncate(
      typeof info.publishedDate === "string" ? info.publishedDate : undefined,
      20,
    ),
    categories: normalizeCategories(info.categories),
  };
}

export async function searchBooks(query: string): Promise<GoogleBookResult[]> {
  const apiKey = getGoogleBooksApiKey();
  const params = new URLSearchParams({
    q: query,
    maxResults: "20",
    printType: "books",
  });
  if (apiKey) params.set("key", apiKey);

  const url = `https://www.googleapis.com/books/v1/volumes?${params}`;
  let response = await fetch(url);

  // If it fails with an API key, retry without it
  if (!response.ok && apiKey) {
    params.delete("key");
    response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?${params}`
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Google Books API error: ${response.status} - ${body.slice(0, 200)}`
    );
  }

  const data: { items?: unknown[] } = await response.json();

  if (!data.items) return [];

  return data.items
    .map(normalizeVolume)
    .filter((book): book is GoogleBookResult => book !== null);
}

export async function getBookById(
  googleBooksId: string
): Promise<GoogleBookResult | null> {
  const normalizedId = normalizeGoogleBooksId(googleBooksId);
  if (!normalizedId) return null;
  const apiKey = getGoogleBooksApiKey();
  const params = new URLSearchParams();
  if (apiKey) params.set("key", apiKey);

  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(normalizedId)}?${params}`
  );

  if (!response.ok) return null;

  const item: GoogleBooksVolume = await response.json();
  return normalizeVolume(item);
}
