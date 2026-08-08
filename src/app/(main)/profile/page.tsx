"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Eye, PenLine, Star, BookMarked } from "lucide-react";
import Bookshelf from "@/components/bookshelf/Bookshelf";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import type { BookDto } from "@/lib/api-types";

type BooksRequest =
  | { status: "loading" }
  | { status: "success"; books: BookDto[] }
  | { status: "error"; message: string };

const EMPTY_BOOKS: BookDto[] = [];

type TabKey = "owned" | "currentlyReading" | "read" | "annotated";

export default function ProfilePage() {
  const [request, setRequest] = useState<BooksRequest>({ status: "loading" });
  const requestController = useRef<AbortController | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("owned");

  const fetchBooks = useCallback(async () => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setRequest({ status: "loading" });

    try {
      const books = await apiFetch<BookDto[]>("/api/books", {
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
        message: apiErrorMessage(error, "Could not load your library"),
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

  const myBooks = useMemo(() => {
    return books.filter((b) => {
      if (!b.currentUserBook) return false;
      switch (activeTab) {
        case "owned":
          return b.currentUserBook.owned;
        case "currentlyReading":
          return b.currentUserBook.currentlyReading;
        case "read":
          return b.currentUserBook.read;
        case "annotated":
          return b.currentUserBook.annotated;
        default:
          return false;
      }
    });
  }, [books, activeTab]);

  const stats = useMemo(() => {
    const owned = books.filter((b) => b.currentUserBook?.owned).length;
    const currentlyReading = books.filter((b) => b.currentUserBook?.currentlyReading).length;
    const read = books.filter((b) => b.currentUserBook?.read).length;
    const annotated = books.filter((b) => b.currentUserBook?.annotated).length;
    const rated = books.filter((b) => b.currentUserBook?.rating).length;
    return { owned, currentlyReading, read, annotated, rated };
  }, [books]);

  const tabs = [
    {
      key: "owned" as TabKey,
      label: "My Books",
      icon: BookOpen,
      count: stats.owned,
    },
    {
      key: "currentlyReading" as TabKey,
      label: "Reading",
      icon: BookMarked,
      count: stats.currentlyReading,
    },
    {
      key: "read" as TabKey,
      label: "Read",
      icon: Eye,
      count: stats.read,
    },
    {
      key: "annotated" as TabKey,
      label: "Annotated",
      icon: PenLine,
      count: stats.annotated,
    },
  ];

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    setActiveTab(tabs[nextIndex].key);
    tabRefs.current[nextIndex]?.focus();
  }

  if (request.status === "loading") {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div role="status" className="flex items-center justify-center gap-3 h-[400px] text-warm-700">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <BookOpen className="w-8 h-8 text-warm-500" />
          </motion.div>
          <span className="text-sm">Loading your library...</span>
        </div>
      </div>
    );
  }

  if (request.status === "error") {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="card-warm max-w-xl mx-auto p-6 text-center">
          <h1 className="font-serif text-xl font-bold text-warm-900 mb-2">
            Couldn&apos;t load your library
          </h1>
          <p className="text-warm-600 text-sm mb-5">{request.message}</p>
          <button
            onClick={() => void fetchBooks()}
            className="bg-warm-700 text-cream px-4 py-2 rounded-lg font-medium hover:bg-warm-800 transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-0">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-warm-900 mb-1">
          My Library
        </h1>
        <p className="text-warm-600 text-sm">
          Your personal collection and reading history
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-8">
        {[
          {
            label: "Books Owned",
            value: stats.owned,
            icon: BookOpen,
            color: "bg-warm-700",
          },
          {
            label: "Books Read",
            value: stats.read,
            icon: Eye,
            color: "bg-warm-700",
          },
          {
            label: "Annotated",
            value: stats.annotated,
            icon: PenLine,
            color: "bg-warm-700",
          },
          {
            label: "Reviewed",
            value: stats.rated,
            icon: Star,
            color: "bg-amber-500",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card-warm p-3 sm:p-4"
          >
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div
                className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}
              >
                <stat.icon className="w-5 h-5 text-cream" />
              </div>
              <div>
                <p className="font-serif text-2xl font-bold text-warm-900">
                  {stat.value}
                </p>
                <p className="text-warm-700 text-xs">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Personal library sections"
        className="mb-8 grid grid-cols-2 gap-1 border-b border-warm-300 sm:flex sm:gap-2"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            ref={(element) => { tabRefs.current[index] = element; }}
            type="button"
            id={`profile-tab-${tab.key}`}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls="profile-tab-panel"
            tabIndex={activeTab === tab.key ? 0 : -1}
            onClick={() => setActiveTab(tab.key)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`-mb-px flex min-w-0 items-center justify-center gap-2 border-b-2 px-2 py-3 text-sm font-medium transition-colors sm:px-4 ${
              activeTab === tab.key
                ? "border-warm-700 text-warm-900"
                : "border-transparent text-warm-600 hover:text-warm-800"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key
                  ? "bg-warm-700 text-cream"
                  : "bg-warm-200 text-warm-700"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Book display */}
      <section
        id="profile-tab-panel"
        role="tabpanel"
        aria-labelledby={`profile-tab-${activeTab}`}
        tabIndex={0}
      >
        {myBooks.length > 0 ? (
          <Bookshelf books={myBooks} />
        ) : (
          <div className="text-center py-16">
            <p className="font-serif text-lg text-warm-600 italic">
              No books here yet
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
