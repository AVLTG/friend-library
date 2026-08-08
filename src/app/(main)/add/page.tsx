"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  BookOpen,
  Plus,
  ArrowLeft,
  Edit3,
  Check,
  X,
  Loader2,
  Library,
  ArrowRight,
} from "lucide-react";
import { ApiError, apiErrorMessage, apiFetch } from "@/lib/api-client";
import type { BookDto, CreateBookDto, SearchBookDto } from "@/lib/api-types";
import {
  findEditionIdentityMatch,
  normalizeDuplicateText,
  normalizeGoogleBooksId,
} from "@/lib/book-identity";

type MatchedSearchResult = SearchBookDto & { existingBookId: string };
type AddableSearchResult = SearchBookDto & {
  possibleWorkTitle?: string;
  identityConflict?: true;
};
type LibraryStatus = "loading" | "ready" | "error";

function textSimilar(a: string, b: string): boolean {
  const na = normalizeDuplicateText(a);
  const nb = normalizeDuplicateText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const aChars = [...na];
  const bChars = [...nb];
  const longer = aChars.length > bChars.length ? aChars : bChars;
  const shorter = aChars.length > bChars.length ? bChars : aChars;
  if (shorter.length / longer.length < 0.8) return false;

  let matches = 0;
  const unmatched = [...longer];
  for (const ch of shorter) {
    const idx = unmatched.indexOf(ch);
    if (idx !== -1) {
      matches++;
      unmatched.splice(idx, 1);
    }
  }
  return matches / longer.length > 0.9;
}

function isPossibleWorkMatch(result: SearchBookDto, existing: BookDto): boolean {
  if (!textSimilar(result.title, existing.title)) return false;

  const resultAuthors = result.authors
    .map(normalizeDuplicateText)
    .filter(Boolean);
  const existingAuthors = existing.authors
    .map(normalizeDuplicateText)
    .filter(Boolean);
  return resultAuthors.some((a) =>
    existingAuthors.some((b) => a === b || a.includes(b) || b.includes(a)),
  );
}

function formatSearchError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Search failed. Please try again.";
  }
  const message = error.message.replace(/[.!?]+$/, "");
  if (error.retryAfter !== null) {
    const seconds = Math.max(1, Math.ceil(error.retryAfter));
    const wait =
      seconds >= 60
        ? `${Math.ceil(seconds / 60)} minute${seconds > 60 ? "s" : ""}`
        : `${seconds} second${seconds === 1 ? "" : "s"}`;
    return `${message}. Try again in about ${wait}.`;
  }
  if (error.status === 0) {
    return `${message}. Check your connection and try again.`;
  }
  return `${message}. Please try again.`;
}

export default function AddBookPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchBookDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedBook, setSelectedBook] = useState<SearchBookDto | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [existingBooks, setExistingBooks] = useState<BookDto[]>([]);
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus>("loading");
  const [libraryError, setLibraryError] = useState("");
  const [libraryRequest, setLibraryRequest] = useState(0);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchController = useRef<AbortController | null>(null);
  const searchSequence = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const formHeadingRef = useRef<HTMLHeadingElement>(null);

  // Editable fields
  const [editTitle, setEditTitle] = useState("");
  const [editAuthors, setEditAuthors] = useState("");
  const [editIsbn, setEditIsbn] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPageCount, setEditPageCount] = useState("");
  const [editPublishedDate, setEditPublishedDate] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLibraryStatus("loading");
    setLibraryError("");

    apiFetch<BookDto[]>("/api/books", { signal: controller.signal })
      .then((books) => {
        if (!active) return;
        setExistingBooks(books);
        setLibraryStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setExistingBooks([]);
        setLibraryStatus("error");
        setLibraryError(
          `${apiErrorMessage(error, "Unable to check the shared library")}. Retry to restore duplicate checking.`,
        );
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [libraryRequest]);

  useEffect(() => {
    return () => {
      searchSequence.current += 1;
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchController.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!selectedBook && !showManual) return;
    window.requestAnimationFrame(() => formHeadingRef.current?.focus());
  }, [selectedBook, showManual]);

  const { matchedResults, addableResults } = useMemo(() => {
    if (libraryStatus !== "ready") {
      return {
        matchedResults: [] as MatchedSearchResult[],
        addableResults: results as AddableSearchResult[],
      };
    }

    const matched: MatchedSearchResult[] = [];
    const addable: AddableSearchResult[] = [];

    for (const result of results) {
      const { bookId, conflict } = findEditionIdentityMatch(
        result.id,
        result.isbn,
        existingBooks,
      );
      if (bookId && !conflict) {
        matched.push({ ...result, existingBookId: bookId });
      } else {
        const possibleWork = existingBooks.find((book) =>
          isPossibleWorkMatch(result, book),
        );
        addable.push({
          ...result,
          ...(conflict ? { identityConflict: true as const } : {}),
          ...(possibleWork ? { possibleWorkTitle: possibleWork.title } : {}),
        });
      }
    }

    return { matchedResults: matched, addableResults: addable };
  }, [results, existingBooks, libraryStatus]);

  function handleSearchInput(value: string) {
    setQuery(value);
    const trimmedQuery = value.trim();
    const sequence = ++searchSequence.current;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchController.current?.abort();
    searchController.current = null;
    setResults([]);
    setSearchError("");

    if (trimmedQuery.length < 2) {
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const controller = new AbortController();
      searchController.current = controller;
      try {
        const data = await apiFetch<SearchBookDto[]>(
          `/api/books/search?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal },
        );
        if (sequence === searchSequence.current) {
          setResults(data);
          setSearchError("");
        }
      } catch (error) {
        if (
          sequence !== searchSequence.current ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        setResults([]);
        setSearchError(formatSearchError(error));
      } finally {
        if (sequence === searchSequence.current) {
          setSearching(false);
          if (searchController.current === controller) {
            searchController.current = null;
          }
        }
      }
    }, 400);
  }

  function selectBook(book: SearchBookDto) {
    setSaveError("");
    setSelectedBook(book);
    setEditTitle(book.title);
    setEditAuthors(book.authors.join(", "));
    setEditIsbn(book.isbn || "");
    setEditDescription(book.description || "");
    setEditPageCount(book.pageCount?.toString() || "");
    setEditPublishedDate(book.publishedDate || "");
    setEditMode(false);
  }

  function startManualEntry() {
    setSaveError("");
    setShowManual(true);
    setSelectedBook(null);
    setEditTitle("");
    setEditAuthors("");
    setEditIsbn("");
    setEditDescription("");
    setEditPageCount("");
    setEditPublishedDate("");
    setEditMode(true);
  }

  function closeBookForm() {
    setSelectedBook(null);
    setShowManual(false);
    setEditMode(false);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  async function handleAddBook(event?: React.FormEvent) {
    event?.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const title = editMode ? editTitle.trim() : selectedBook?.title;
      const authors = editMode
        ? editAuthors.split(",").map((a) => a.trim()).filter(Boolean)
        : selectedBook?.authors;
      if (!title || !authors?.length) {
        setSaveError("Title and at least one author are required");
        return;
      }

      const isbn = editMode ? editIsbn.trim() : selectedBook?.isbn;
      const description = editMode
        ? editDescription.trim()
        : selectedBook?.description;
      const pageCount = editMode
        ? editPageCount
          ? Number.parseInt(editPageCount, 10)
          : null
        : selectedBook?.pageCount;
      const publishedDate = editMode
        ? editPublishedDate.trim()
        : selectedBook?.publishedDate;
      const googleBooksId = selectedBook
        ? normalizeGoogleBooksId(selectedBook.id)
        : null;
      const bookData = {
        title,
        authors,
        ...(isbn ? { isbn } : {}),
        ...(description ? { description } : {}),
        ...(selectedBook?.coverUrl ? { coverUrl: selectedBook.coverUrl } : {}),
        ...(pageCount ? { pageCount } : {}),
        ...(publishedDate ? { publishedDate } : {}),
        ...(selectedBook?.categories.length
          ? { categories: selectedBook.categories }
          : {}),
        ...(googleBooksId ? { googleBooksId } : {}),
      };

      const data = await apiFetch<CreateBookDto>("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookData),
      });
      router.push(`/book/${data.bookId}`);
    } catch (error) {
      setSaveError(apiErrorMessage(error, "Failed to add book. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => router.back()}
        className="flex min-h-11 items-center gap-2 text-warm-700 hover:text-warm-900 transition-colors mb-6 text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="font-serif text-3xl font-bold text-warm-900 mb-2">
        Add a Book
      </h1>
      <p className="text-warm-600 text-sm mb-8">
        Search for a book or add one manually.
      </p>

      <AnimatePresence mode="wait">
        {(selectedBook || showManual) ? (
          <motion.div
            key="selected"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <form onSubmit={handleAddBook} className="card-warm p-4 sm:p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <h2 ref={formHeadingRef} tabIndex={-1} className="font-serif text-lg font-bold text-warm-900 focus:outline-none">
                  {editMode ? "Edit Details" : "Confirm Book"}
                </h2>
                <div className="flex gap-2">
                  {!editMode && selectedBook && (
                    <button
                      type="button"
                      onClick={() => setEditMode(true)}
                      className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-warm-700 hover:bg-warm-100 hover:text-warm-900"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeBookForm}
                    aria-label="Close book details"
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-warm-600 hover:bg-warm-100 hover:text-warm-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-6 sm:flex-row">
                {selectedBook?.coverUrl && !editMode && (
                  <div className="flex-shrink-0">
                    <div className="relative w-[100px] h-[150px] rounded-md overflow-hidden shadow-lg">
                      <Image
                        src={selectedBook.coverUrl}
                        alt={selectedBook.title}
                        fill
                        className="object-cover"
                        sizes="100px"
                      />
                    </div>
                  </div>
                )}

                <div className="flex-1 space-y-3">
                  {editMode ? (
                    <>
                      <div>
                        <label htmlFor="book-title" className="block text-xs font-medium text-warm-700 mb-1">Title</label>
                        <input id="book-title" type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={500} required className="w-full px-3 py-2 bg-cream border border-warm-500 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-warm-700" />
                      </div>
                      <div>
                        <label htmlFor="book-authors" className="block text-xs font-medium text-warm-700 mb-1">Authors (comma separated)</label>
                        <input id="book-authors" type="text" value={editAuthors} onChange={(e) => setEditAuthors(e.target.value)} maxLength={4000} required className="w-full px-3 py-2 bg-cream border border-warm-500 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-warm-700" />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="book-isbn" className="block text-xs font-medium text-warm-700 mb-1">ISBN</label>
                          <input id="book-isbn" type="text" inputMode="numeric" value={editIsbn} onChange={(e) => setEditIsbn(e.target.value)} maxLength={20} className="w-full px-3 py-2 bg-cream border border-warm-500 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-warm-700" />
                        </div>
                        <div>
                          <label htmlFor="book-page-count" className="block text-xs font-medium text-warm-700 mb-1">Page Count</label>
                          <input id="book-page-count" type="number" value={editPageCount} onChange={(e) => setEditPageCount(e.target.value)} min={1} max={99999} className="w-full px-3 py-2 bg-cream border border-warm-500 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-warm-700" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="book-published-date" className="block text-xs font-medium text-warm-700 mb-1">Published Date</label>
                        <input id="book-published-date" type="text" value={editPublishedDate} onChange={(e) => setEditPublishedDate(e.target.value)} maxLength={20} placeholder="e.g. 2024" className="w-full px-3 py-2 bg-cream border border-warm-500 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-warm-700" />
                      </div>
                      <div>
                        <label htmlFor="book-description" className="block text-xs font-medium text-warm-700 mb-1">Description</label>
                        <textarea id="book-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} maxLength={5000} className="w-full px-3 py-2 bg-cream border border-warm-500 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-warm-700 resize-y" />
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="break-words font-serif text-xl font-bold text-warm-900">{selectedBook?.title}</h3>
                      <p className="text-warm-600 text-sm">by {selectedBook?.authors.join(", ")}</p>
                      {selectedBook?.description && (
                        <p className="text-warm-700 text-xs line-clamp-3">{selectedBook.description.replace(/<[^>]*>/g, "")}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {saveError && (
                <p role="alert" className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {saveError}
                </p>
              )}

              <button
                type="submit"
                disabled={saving || (editMode && (!editTitle || !editAuthors))}
                className="mt-6 w-full flex items-center justify-center gap-2 bg-warm-700 text-cream py-3 rounded-lg font-medium hover:bg-warm-800 transition-colors disabled:opacity-50 text-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? "Adding..." : "Add to Library"}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Search bar */}
            <div className="relative mb-6">
              <Search aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warm-600" />
              <label htmlFor="add-book-search" className="sr-only">Search by title, author, or ISBN</label>
              <input
                ref={searchInputRef}
                id="add-book-search"
                type="search"
                value={query}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search by title, author, or ISBN..."
                aria-controls="book-search-results"
                aria-busy={searching}
                className="w-full pl-12 pr-12 py-3.5 bg-warm-50 border border-warm-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 placeholder-warm-600"
                autoFocus
              />
              {searching && (
                <Loader2 aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warm-600 animate-spin" />
              )}
            </div>

            {libraryStatus === "error" && (
              <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p>{libraryError}</p>
                <button
                  onClick={() => setLibraryRequest((request) => request + 1)}
                  className="flex-shrink-0 font-medium underline decoration-amber-300 hover:text-amber-950"
                >
                  Retry
                </button>
              </div>
            )}

            {searchError && (
              <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p>{searchError}</p>
                <button
                  onClick={() => handleSearchInput(query)}
                  className="flex-shrink-0 font-medium underline decoration-red-300 hover:text-red-900"
                >
                  Retry search
                </button>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <section id="book-search-results" aria-busy={searching} className="mb-6">
                {/* Already in library section */}
                {matchedResults.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <Library className="w-4 h-4 text-warm-400" />
                      <h2 className="text-xs font-medium text-warm-700 uppercase tracking-wider">
                        Already in your library
                      </h2>
                      <div className="flex-1 h-[1px] bg-warm-200" />
                    </div>
                    <div className="space-y-2">
                      {matchedResults.map((book, i) => (
                        <motion.button
                          key={`match-${book.id}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => router.push(`/book/${book.existingBookId}`)}
                          className="w-full flex items-center gap-4 p-3 bg-warm-100/60 border border-warm-200 rounded-xl hover:bg-warm-100 transition-colors text-left"
                        >
                          {book.coverUrl ? (
                            <div className="relative w-[50px] h-[75px] rounded overflow-hidden flex-shrink-0 shadow-sm">
                              <Image src={book.coverUrl} alt={book.title} fill className="object-cover" sizes="50px" />
                            </div>
                          ) : (
                            <div className="w-[50px] h-[75px] rounded bg-warm-200 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-5 h-5 text-warm-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-serif font-bold text-warm-900 text-sm truncate">{book.title}</h3>
                            <p className="text-warm-700 text-xs truncate">{book.authors.join(", ")}</p>
                            <p className="text-warm-600 text-xs mt-1 italic">Already in shared library</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-warm-400 flex-shrink-0" />
                        </motion.button>
                      ))}
                    </div>
                    {/* Closing divider */}
                    <div className="flex items-center gap-2 mt-3 mb-4 px-1">
                      <div className="flex-1 h-[1px] bg-warm-200" />
                    </div>
                  </>
                )}

                {/* New books section */}
                {addableResults.length > 0 && (
                  <>
                    {(matchedResults.length > 0 || libraryStatus !== "ready") && (
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <Plus className="w-4 h-4 text-warm-400" />
                        <h2 className="text-xs font-medium text-warm-700 uppercase tracking-wider">
                          {libraryStatus === "ready" ? "Add new" : "Search results"}
                        </h2>
                        <div className="flex-1 h-[1px] bg-warm-200" />
                      </div>
                    )}
                    <div className="space-y-2">
                      {addableResults.map((book, i) => (
                        <motion.button
                          key={book.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: (matchedResults.length + i) * 0.05 }}
                          onClick={() => selectBook(book)}
                          className="w-full flex items-center gap-4 p-3 card-warm hover:bg-warm-100/50 transition-colors text-left"
                        >
                          {book.coverUrl ? (
                            <div className="relative w-[50px] h-[75px] rounded overflow-hidden flex-shrink-0 shadow-sm">
                              <Image src={book.coverUrl} alt={book.title} fill className="object-cover" sizes="50px" />
                            </div>
                          ) : (
                            <div className="w-[50px] h-[75px] rounded bg-warm-200 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-5 h-5 text-warm-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-serif font-bold text-warm-900 text-sm truncate">{book.title}</h3>
                            <p className="text-warm-700 text-xs truncate">{book.authors.join(", ")}</p>
                            {book.publishedDate && (
                              <p className="text-warm-600 text-xs mt-0.5">{book.publishedDate}</p>
                            )}
                            {book.possibleWorkTitle && (
                              <p className="text-amber-700/80 text-xs mt-1">
                                Possible match to another edition of &quot;{book.possibleWorkTitle}&quot;
                              </p>
                            )}
                            {book.identityConflict && (
                              <p className="text-red-700/80 text-xs mt-1">
                                Conflicting edition identifiers. Select this result to review the server error.
                              </p>
                            )}
                            {libraryStatus === "loading" && (
                              <p className="text-warm-600 text-xs mt-1 italic">
                                Checking the shared library for matches
                              </p>
                            )}
                            {libraryStatus === "error" && (
                              <p className="text-amber-700/80 text-xs mt-1 italic">
                                Library match status unavailable
                              </p>
                            )}
                          </div>
                          <Plus className="w-5 h-5 text-warm-400 flex-shrink-0" />
                        </motion.button>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* No results */}
            {query.trim().length >= 2 && !searching && !searchError && results.length === 0 && (
              <div role="status" className="text-center py-8">
                <p className="text-warm-600 text-sm mb-2">
                  No books found for &quot;{query.trim()}&quot;
                </p>
              </div>
            )}

            {/* Manual entry */}
            <div className="text-center pt-4 border-t border-warm-200">
              <button
                type="button"
                onClick={startManualEntry}
                className="min-h-11 text-sm text-warm-700 hover:text-warm-900 underline decoration-warm-500"
              >
                Can&apos;t find it? Add manually
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="sr-only" role="status" aria-live="polite">
        {searching
          ? "Searching for books"
          : !searchError && results.length > 0
              ? `${results.length} search ${results.length === 1 ? "result" : "results"}`
              : ""}
      </p>
    </div>
  );
}
