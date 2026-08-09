import { getGoogleBooksApiKey } from "./env";
import { normalizeGoogleBooksId, normalizeIsbn } from "./book-identity";
import { sanitizeText } from "./sanitize";
import { safeCoverUrl } from "./validation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
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

function normalizeVolume(item: unknown): GoogleBookResult | null {
  if (!isRecord(item) || typeof item.id !== "string") return null;
  const id = normalizeGoogleBooksId(item.id);
  const info = item.volumeInfo;
  if (!isRecord(info)) return null;
  const title = typeof info.title === "string" ? sanitizeText(info.title, 500) : "";
  if (!id || !title) return null;

  const identifiers: Array<{ type: string; identifier: string }> = Array.isArray(
    info.industryIdentifiers,
  )
    ? info.industryIdentifiers.filter(
        (entry): entry is { type: string; identifier: string } =>
          isRecord(entry) &&
          typeof entry.type === "string" &&
          typeof entry.identifier === "string",
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

  const imageLinks = isRecord(info.imageLinks) ? info.imageLinks : null;
  let coverUrl =
    typeof imageLinks?.thumbnail === "string"
      ? imageLinks.thumbnail
      : typeof imageLinks?.smallThumbnail === "string"
        ? imageLinks.smallThumbnail
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
    description:
      typeof info.description === "string"
        ? sanitizeText(info.description, 5000)
        : undefined,
    isbn,
    coverUrl: safeCoverUrl(coverUrl) || undefined,
    pageCount:
      typeof info.pageCount === "number" &&
      Number.isInteger(info.pageCount) &&
      info.pageCount > 0 &&
      info.pageCount <= 99999
        ? info.pageCount
        : undefined,
    publishedDate:
      typeof info.publishedDate === "string"
        ? sanitizeText(info.publishedDate, 20)
        : undefined,
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

  const data: unknown = await response.json();
  if (!isRecord(data) || !Array.isArray(data.items)) return [];

  return data.items
    .map(normalizeVolume)
    .filter((book): book is GoogleBookResult => book !== null);
}
