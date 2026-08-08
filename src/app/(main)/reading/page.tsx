"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { BookOpen, BookMarked } from "lucide-react";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import type { ReadingEntryDto } from "@/lib/api-types";

type ReadingRequest =
  | { status: "loading" }
  | { status: "success"; entries: ReadingEntryDto[] }
  | { status: "error"; message: string };

export default function ReadingPage() {
  const router = useRouter();
  const [request, setRequest] = useState<ReadingRequest>({ status: "loading" });
  const requestController = useRef<AbortController | null>(null);

  const fetchReading = useCallback(async () => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setRequest({ status: "loading" });

    try {
      const entries = await apiFetch<ReadingEntryDto[]>("/api/books/reading", {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setRequest({ status: "success", entries });
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
        message: apiErrorMessage(error, "Could not load current reading activity"),
      });
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void fetchReading();
    return () => requestController.current?.abort();
  }, [fetchReading]);

  const entries = request.status === "success" ? request.entries : [];

  // Group by user
  const byUser = entries.reduce<Record<string, { user: ReadingEntryDto["user"]; books: ReadingEntryDto["book"][] }>>(
    (acc, entry) => {
      if (!acc[entry.user.id]) {
        acc[entry.user.id] = { user: entry.user, books: [] };
      }
      acc[entry.user.id].books.push(entry.book);
      return acc;
    },
    {}
  );

  if (request.status === "loading") {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-center h-[300px]">
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

  if (request.status === "error") {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="card-warm max-w-xl mx-auto p-6 text-center">
          <h1 className="font-serif text-xl font-bold text-warm-900 mb-2">
            Couldn&apos;t load current reading activity
          </h1>
          <p className="text-warm-500 text-sm mb-5">{request.message}</p>
          <button
            onClick={() => void fetchReading()}
            className="bg-warm-700 text-cream px-4 py-2 rounded-lg font-medium hover:bg-warm-800 transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-warm-900 mb-1">
          Currently Reading
        </h1>
        <p className="text-warm-500 text-sm">
          See what everyone in the group is reading right now
        </p>
      </div>

      {Object.keys(byUser).length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-warm-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookMarked className="w-8 h-8 text-warm-400" />
          </div>
          <p className="font-serif text-lg text-warm-500">
            Nobody is reading anything right now
          </p>
          <p className="text-warm-400 text-sm mt-1">
            Mark a book as &quot;Currently reading&quot; to show up here
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.values(byUser).map(({ user, books }, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card-warm p-6"
            >
              {/* User header */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: user.avatarColor }}
                >
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div>
                  <h2 className="font-serif font-bold text-warm-900">
                    {user.firstName} {user.lastName}
                  </h2>
                  <p className="text-warm-500 text-xs">
                    Reading {books.length} {books.length === 1 ? "book" : "books"}
                  </p>
                </div>
              </div>

              {/* Books */}
              <div className="flex flex-wrap gap-4">
                {books.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => router.push(`/book/${book.id}`)}
                    className="flex gap-3 p-3 bg-cream rounded-lg hover:bg-warm-100 transition-colors text-left w-full sm:w-auto sm:min-w-[280px]"
                  >
                    {book.coverUrl ? (
                      <div className="relative w-[50px] h-[75px] rounded overflow-hidden flex-shrink-0 shadow-sm">
                        <Image
                          src={book.coverUrl}
                          alt={book.title}
                          fill
                          className="object-cover"
                          sizes="50px"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-[50px] h-[75px] rounded flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: book.spineColor }}
                      >
                        <BookOpen className="w-4 h-4 text-white/70" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif font-bold text-warm-900 text-sm leading-tight">
                        {book.title}
                      </h3>
                      <p className="text-warm-500 text-xs mt-0.5">
                        {book.authors.join(", ")}
                      </p>
                      {book.pageCount && (
                        <p className="text-warm-400 text-xs mt-1">
                          {book.pageCount} pages
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
