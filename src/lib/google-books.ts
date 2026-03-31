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

export async function searchBooks(query: string): Promise<GoogleBookResult[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
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

  const data = await response.json();

  if (!data.items) return [];

  return data.items.map((item: GoogleBooksVolume) => {
    const info = item.volumeInfo;
    const isbn = info.industryIdentifiers?.find(
      (id) => id.type === "ISBN_13" || id.type === "ISBN_10"
    );

    // Get higher quality cover by replacing zoom parameter
    let coverUrl = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail;
    if (coverUrl) {
      coverUrl = coverUrl.replace("zoom=1", "zoom=2").replace("http://", "https://");
    }

    return {
      id: item.id,
      title: info.title,
      authors: info.authors || ["Unknown Author"],
      description: info.description,
      isbn: isbn?.identifier,
      coverUrl,
      pageCount: info.pageCount,
      publishedDate: info.publishedDate,
      categories: info.categories,
    };
  });
}

export async function getBookById(
  googleBooksId: string
): Promise<GoogleBookResult | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams();
  if (apiKey) params.set("key", apiKey);

  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes/${googleBooksId}?${params}`
  );

  if (!response.ok) return null;

  const item: GoogleBooksVolume = await response.json();
  const info = item.volumeInfo;
  const isbn = info.industryIdentifiers?.find(
    (id) => id.type === "ISBN_13" || id.type === "ISBN_10"
  );

  let coverUrl = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail;
  if (coverUrl) {
    coverUrl = coverUrl.replace("zoom=1", "zoom=2").replace("http://", "https://");
  }

  return {
    id: item.id,
    title: info.title,
    authors: info.authors || ["Unknown Author"],
    description: info.description,
    isbn: isbn?.identifier,
    coverUrl,
    pageCount: info.pageCount,
    publishedDate: info.publishedDate,
    categories: info.categories,
  };
}
