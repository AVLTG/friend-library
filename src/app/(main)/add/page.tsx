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

interface SearchResult {
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

interface ExistingBook {
  id: string;
  title: string;
  authors: string[];
  googleBooksId?: string;
  isbn?: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function titleSimilar(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  // Exact match after normalization
  if (na === nb) return true;
  // One contains the other
  if (na.includes(nb) || nb.includes(na)) return true;
  // Check if 85%+ characters overlap (simple similarity)
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  if (shorter.length / longer.length < 0.7) return false;
  let matches = 0;
  const longerArr = [...longer];
  for (const ch of shorter) {
    const idx = longerArr.indexOf(ch);
    if (idx !== -1) {
      matches++;
      longerArr.splice(idx, 1);
    }
  }
  return matches / longer.length > 0.85;
}

function isExistingMatch(result: SearchResult, existing: ExistingBook): boolean {
  // Match by Google Books ID
  if (result.id && existing.googleBooksId && result.id === existing.googleBooksId) return true;
  // Match by ISBN
  if (result.isbn && existing.isbn && result.isbn === existing.isbn) return true;
  // Fuzzy title + author match
  if (titleSimilar(result.title, existing.title)) {
    const resultAuthors = result.authors.map(normalize);
    const existingAuthors = existing.authors.map(normalize);
    const authorOverlap = resultAuthors.some((a) =>
      existingAuthors.some((b) => a === b || a.includes(b) || b.includes(a))
    );
    if (authorOverlap) return true;
  }
  return false;
}

export default function AddBookPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState<SearchResult | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [existingBooks, setExistingBooks] = useState<ExistingBook[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  // Editable fields
  const [editTitle, setEditTitle] = useState("");
  const [editAuthors, setEditAuthors] = useState("");
  const [editIsbn, setEditIsbn] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPageCount, setEditPageCount] = useState("");
  const [editPublishedDate, setEditPublishedDate] = useState("");

  // Fetch existing library books once
  useEffect(() => {
    fetch("/api/books")
      .then((r) => r.json())
      .then((data) => {
        setExistingBooks(
          data.map((b: ExistingBook & { googleBooksId?: string }) => ({
            id: b.id,
            title: b.title,
            authors: b.authors,
            googleBooksId: b.googleBooksId,
            isbn: b.isbn,
          }))
        );
      })
      .catch(() => {});
  }, []);

  // Split results into matches and new
  const { matchedResults, newResults } = useMemo(() => {
    const matched: Array<SearchResult & { existingBookId: string }> = [];
    const fresh: SearchResult[] = [];

    for (const result of results) {
      const match = existingBooks.find((eb) => isExistingMatch(result, eb));
      if (match) {
        matched.push({ ...result, existingBookId: match.id });
      } else {
        fresh.push(result);
      }
    }

    return { matchedResults: matched, newResults: fresh };
  }, [results, existingBooks]);

  function handleSearchInput(value: string) {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    searchTimeout.current = setTimeout(() => doSearch(value), 400);
  }

  async function doSearch(q: string) {
    setSearching(true);
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearching(false);
    }
  }

  function selectBook(book: SearchResult) {
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

  async function handleAddBook() {
    setSaving(true);
    try {
      const bookData = {
        title: editMode ? editTitle : selectedBook?.title,
        authors: editMode
          ? editAuthors.split(",").map((a) => a.trim()).filter(Boolean)
          : selectedBook?.authors,
        isbn: editMode ? editIsbn || undefined : selectedBook?.isbn,
        description: editMode
          ? editDescription || undefined
          : selectedBook?.description,
        coverUrl: selectedBook?.coverUrl,
        pageCount: editMode
          ? editPageCount
            ? parseInt(editPageCount)
            : undefined
          : selectedBook?.pageCount,
        publishedDate: editMode
          ? editPublishedDate || undefined
          : selectedBook?.publishedDate,
        categories: selectedBook?.categories,
        googleBooksId: selectedBook?.id,
      };

      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookData),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/book/${data.bookId}`);
      }
    } catch (error) {
      console.error("Failed to add book:", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-warm-500 hover:text-warm-700 transition-colors mb-6 text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="font-serif text-3xl font-bold text-warm-900 mb-2">
        Add a Book
      </h1>
      <p className="text-warm-500 text-sm mb-8">
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
            <div className="card-warm p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="font-serif text-lg font-bold text-warm-900">
                  {editMode ? "Edit Details" : "Confirm Book"}
                </h2>
                <div className="flex gap-2">
                  {!editMode && selectedBook && (
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-1.5 text-sm text-warm-500 hover:text-warm-700"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedBook(null);
                      setShowManual(false);
                      setEditMode(false);
                    }}
                    className="text-warm-400 hover:text-warm-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex gap-6">
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
                        <label className="block text-xs font-medium text-warm-600 mb-1">Title *</label>
                        <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full px-3 py-2 bg-cream border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-warm-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-warm-600 mb-1">Authors * (comma separated)</label>
                        <input type="text" value={editAuthors} onChange={(e) => setEditAuthors(e.target.value)} className="w-full px-3 py-2 bg-cream border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-warm-400" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-warm-600 mb-1">ISBN</label>
                          <input type="text" value={editIsbn} onChange={(e) => setEditIsbn(e.target.value)} className="w-full px-3 py-2 bg-cream border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-warm-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-warm-600 mb-1">Page Count</label>
                          <input type="number" value={editPageCount} onChange={(e) => setEditPageCount(e.target.value)} className="w-full px-3 py-2 bg-cream border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-warm-400" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-warm-600 mb-1">Published Date</label>
                        <input type="text" value={editPublishedDate} onChange={(e) => setEditPublishedDate(e.target.value)} placeholder="e.g. 2024" className="w-full px-3 py-2 bg-cream border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-warm-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-warm-600 mb-1">Description</label>
                        <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} className="w-full px-3 py-2 bg-cream border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-warm-400 resize-none" />
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="font-serif text-xl font-bold text-warm-900">{selectedBook?.title}</h3>
                      <p className="text-warm-600 text-sm">by {selectedBook?.authors.join(", ")}</p>
                      {selectedBook?.description && (
                        <p className="text-warm-500 text-xs line-clamp-3">{selectedBook.description.replace(/<[^>]*>/g, "")}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={handleAddBook}
                disabled={saving || (editMode && (!editTitle || !editAuthors))}
                className="mt-6 w-full flex items-center justify-center gap-2 bg-warm-700 text-cream py-3 rounded-lg font-medium hover:bg-warm-800 transition-colors disabled:opacity-50 text-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? "Adding..." : "Add to Library"}
              </button>
            </div>
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
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warm-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search by title, author, or ISBN..."
                className="w-full pl-12 pr-4 py-3.5 bg-warm-50 border border-warm-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 placeholder-warm-400"
                autoFocus
              />
              {searching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warm-400 animate-spin" />
              )}
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="mb-6">
                {/* Already in library section */}
                {matchedResults.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <Library className="w-4 h-4 text-warm-400" />
                      <span className="text-xs font-medium text-warm-500 uppercase tracking-wider">
                        Already in your library
                      </span>
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
                            <p className="text-warm-500 text-xs truncate">{book.authors.join(", ")}</p>
                            <p className="text-warm-400 text-xs mt-1 italic">Already in shared library</p>
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
                {newResults.length > 0 && (
                  <>
                    {matchedResults.length > 0 && (
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <Plus className="w-4 h-4 text-warm-400" />
                        <span className="text-xs font-medium text-warm-500 uppercase tracking-wider">
                          Add new
                        </span>
                        <div className="flex-1 h-[1px] bg-warm-200" />
                      </div>
                    )}
                    <div className="space-y-2">
                      {newResults.map((book, i) => (
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
                            <p className="text-warm-500 text-xs truncate">{book.authors.join(", ")}</p>
                            {book.publishedDate && (
                              <p className="text-warm-400 text-xs mt-0.5">{book.publishedDate}</p>
                            )}
                          </div>
                          <Plus className="w-5 h-5 text-warm-400 flex-shrink-0" />
                        </motion.button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* No results */}
            {query.length >= 2 && !searching && results.length === 0 && (
              <div className="text-center py-8">
                <p className="text-warm-500 text-sm mb-2">
                  No books found for &quot;{query}&quot;
                </p>
              </div>
            )}

            {/* Manual entry */}
            <div className="text-center pt-4 border-t border-warm-200">
              <button
                onClick={startManualEntry}
                className="text-sm text-warm-500 hover:text-warm-700 underline decoration-warm-300"
              >
                Can&apos;t find it? Add manually
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
