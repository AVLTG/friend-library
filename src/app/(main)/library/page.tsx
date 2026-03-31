"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";
import Bookshelf from "@/components/bookshelf/Bookshelf";
import FilterBar from "@/components/bookshelf/FilterBar";
import type { BookData } from "@/components/bookshelf/BookSpine";

interface BookWithDetails extends BookData {
  description?: string;
  isbn?: string;
  publishedDate?: string;
  categories: string[];
  readers: Array<{ id: string; firstName: string; avatarColor: string }>;
  annotators: Array<{ id: string; firstName: string; avatarColor: string }>;
  ratings: Array<{
    userId: string;
    firstName: string;
    username: string;
    avatarColor: string;
    rating: number;
    review?: string;
  }>;
  createdAt: string;
}

export default function LibraryPage() {
  const [books, setBooks] = useState<BookWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("title");
  const [filterOwner, setFilterOwner] = useState("");

  useEffect(() => {
    fetchBooks();
  }, []);

  async function fetchBooks() {
    try {
      const res = await fetch("/api/books");
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
      }
    } catch (error) {
      console.error("Failed to fetch books:", error);
    } finally {
      setLoading(false);
    }
  }

  // Get unique owners across all books
  const allOwners = useMemo(() => {
    const ownerMap = new Map<
      string,
      { id: string; firstName: string; username: string; avatarColor: string }
    >();
    books.forEach((book) => {
      book.owners.forEach((owner) => {
        if (!ownerMap.has(owner.id)) {
          ownerMap.set(owner.id, owner as typeof ownerMap extends Map<string, infer V> ? V : never);
        }
      });
    });
    return Array.from(ownerMap.values());
  }, [books]);

  // Filter and sort
  const filteredBooks = useMemo(() => {
    let result = [...books];

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.authors.some((a) => a.toLowerCase().includes(q))
      );
    }

    // Owner filter
    if (filterOwner) {
      result = result.filter((b) =>
        b.owners.some((o) => o.id === filterOwner)
      );
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
  }, [books, search, sortBy, filterOwner]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-center h-[400px]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <BookOpen className="w-8 h-8 text-warm-500" />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-warm-900">
            Shared Library
          </h1>
          <p className="text-warm-500 text-sm mt-1">
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
          owners={allOwners}
        />
      </div>

      {/* Bookshelf */}
      {filteredBooks.length > 0 ? (
        <Bookshelf books={filteredBooks} />
      ) : books.length > 0 ? (
        <div className="text-center py-16">
          <p className="font-serif text-lg text-warm-500">
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
            <p className="text-warm-500 mb-6">
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
