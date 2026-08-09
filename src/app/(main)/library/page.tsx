"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";
import Bookshelf from "@/components/bookshelf/Bookshelf";
import FilterBar from "@/components/bookshelf/FilterBar";
import LoadError from "@/components/LoadError";
import LoadingState from "@/components/LoadingState";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import {
  booksResponseSchema,
  type BookDto,
  type PublicUserDto,
} from "@/lib/api-types";

type BooksRequest =
  | { status: "loading" }
  | { status: "success"; books: BookDto[] }
  | { status: "error"; message: string };

const EMPTY_BOOKS: BookDto[] = [];

function uniqueUsers(users: PublicUserDto[]): PublicUserDto[] {
  return Array.from(new Map(users.map((user) => [user.id, user])).values());
}

export default function LibraryPage() {
  const [request, setRequest] = useState<BooksRequest>({ status: "loading" });
  const requestController = useRef<AbortController | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("title");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterReadBy, setFilterReadBy] = useState("");
  const [filterCurrentlyReading, setFilterCurrentlyReading] = useState("");

  const fetchBooks = useCallback(async () => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setRequest({ status: "loading" });

    try {
      const books = await apiFetch("/api/books", booksResponseSchema, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setRequest({ status: "success", books });
      }
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return;
      }
      setRequest({
        status: "error",
        message: apiErrorMessage(error, "Could not load the shared library"),
      });
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void fetchBooks();
    return () => requestController.current?.abort();
  }, [fetchBooks]);

  const books = request.status === "success" ? request.books : EMPTY_BOOKS;

  const allOwners = useMemo(() => {
    return uniqueUsers(books.flatMap((book) => book.owners));
  }, [books]);

  const allReaders = useMemo(() => {
    return uniqueUsers(books.flatMap((book) => book.readers));
  }, [books]);

  const allCurrentlyReading = useMemo(() => {
    return uniqueUsers(books.flatMap((book) => book.currentlyReading));
  }, [books]);

  // Get unique categories across all books
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    books.forEach((book) => {
      book.categories?.forEach((c) => cats.add(c));
    });
    return Array.from(cats).sort();
  }, [books]);

  // Filter and sort
  const filteredBooks = useMemo(() => {
    let result = [...books];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.authors.some((a) => a.toLowerCase().includes(q))
      );
    }

    if (filterOwner) {
      if (filterOwner === "__any") {
        result = result.filter((b) => b.owners.length > 0);
      } else {
        result = result.filter((b) =>
          b.owners.some((o) => o.id === filterOwner)
        );
      }
    }

    if (filterCategory) {
      result = result.filter((b) =>
        b.categories?.includes(filterCategory)
      );
    }

    if (filterReadBy) {
      if (filterReadBy === "__any") {
        result = result.filter((b) => b.readers.length > 0);
      } else {
        result = result.filter((b) =>
          b.readers.some((r) => r.id === filterReadBy)
        );
      }
    }

    if (filterCurrentlyReading) {
      if (filterCurrentlyReading === "__any") {
        result = result.filter((b) => b.currentlyReading.length > 0);
      } else {
        result = result.filter((b) =>
          b.currentlyReading.some((r) => r.id === filterCurrentlyReading)
        );
      }
    }

    // Sort
    switch (sortBy) {
      case "title":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "author":
        result.sort((a, b) =>
          (a.authors[0] || "").localeCompare(b.authors[0] || "")
        );
        break;
      case "rating":
        result.sort(
          (a, b) => (b.averageRating || 0) - (a.averageRating || 0)
        );
        break;
      case "recent":
        result.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    return result;
  }, [books, search, sortBy, filterOwner, filterCategory, filterReadBy, filterCurrentlyReading]);

  if (request.status === "loading") {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <LoadingState
          message="Loading the shared library..."
          className="h-[400px]"
        />
      </div>
    );
  }

  if (request.status === "error") {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <LoadError
          title="Couldn't load the shared library"
          message={request.message}
          onRetry={() => void fetchBooks()}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-0">
      {/* Header */}
      <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-warm-900">
            Shared Library
          </h1>
          <p className="text-warm-600 text-sm mt-1">
            {books.length} {books.length === 1 ? "book" : "books"} in the collection
          </p>
        </div>
        <Link
          href="/add"
          className="flex items-center gap-2 bg-warm-700 text-cream px-4 py-2.5 rounded-lg font-medium hover:bg-warm-800 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Book
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-8">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          sortBy={sortBy}
          onSortChange={setSortBy}
          filterOwner={filterOwner}
          onFilterOwnerChange={setFilterOwner}
          filterCategory={filterCategory}
          onFilterCategoryChange={setFilterCategory}
          filterReadBy={filterReadBy}
          onFilterReadByChange={setFilterReadBy}
          filterCurrentlyReading={filterCurrentlyReading}
          onFilterCurrentlyReadingChange={setFilterCurrentlyReading}
          owners={allOwners}
          readers={allReaders}
          currentlyReadingUsers={allCurrentlyReading}
          categories={allCategories}
        />
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Showing {filteredBooks.length} of {books.length} books
      </p>

      {/* Bookshelf */}
      {filteredBooks.length > 0 ? (
        <section aria-label="Books matching the current filters">
          <Bookshelf books={filteredBooks} />
        </section>
      ) : books.length > 0 ? (
        <div className="text-center py-16">
          <p className="font-serif text-lg text-warm-600">
            No books match your search
          </p>
        </div>
      ) : (
        <div className="text-center py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto"
          >
            <div className="w-20 h-20 bg-warm-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-warm-400" />
            </div>
            <h2 className="font-serif text-xl font-bold text-warm-700 mb-2">
              Your library is empty
            </h2>
            <p className="text-warm-600 mb-6">
              Start building your shared collection by adding your first book.
            </p>
            <Link
              href="/add"
              className="inline-flex items-center gap-2 bg-warm-700 text-cream px-6 py-3 rounded-lg font-medium hover:bg-warm-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Your First Book
            </Link>
          </motion.div>
        </div>
      )}
    </div>
  );
}
