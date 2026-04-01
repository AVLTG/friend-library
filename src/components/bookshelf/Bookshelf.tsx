"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Shelf from "./Shelf";
import BookSpine, { type BookData } from "./BookSpine";

const MIN_SHELVES = 4;

interface BookshelfProps {
  books: BookData[];
  booksPerShelf?: number;
}

export default function Bookshelf({
  books,
  booksPerShelf = 15,
}: BookshelfProps) {
  const router = useRouter();

  const shelves = useMemo(() => {
    const result: BookData[][] = [];
    for (let i = 0; i < books.length; i += booksPerShelf) {
      result.push(books.slice(i, i + booksPerShelf));
    }
    // Pad to minimum shelves so the bookcase always looks full-sized
    while (result.length < MIN_SHELVES) {
      result.push([]);
    }
    return result;
  }, [books, booksPerShelf]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      {/* Bookcase frame */}
      <div
        className="relative rounded-lg overflow-hidden"
        style={{
          boxShadow: `
            0 8px 32px rgba(74, 55, 40, 0.25),
            0 2px 8px rgba(74, 55, 40, 0.15),
            inset 0 0 60px rgba(74, 55, 40, 0.05)`,
        }}
      >
        {/* Back panel */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg,
              #E8D5B8 0%,
              #DCC8A8 20%,
              #D4BC98 50%,
              #CCAF88 80%,
              #C4A278 100%)`,
          }}
        >
          {/* Subtle wood panel texture on back */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 120px,
                rgba(139, 105, 20, 0.08) 120px,
                rgba(139, 105, 20, 0.08) 121px
              ), repeating-linear-gradient(
                90deg,
                transparent,
                transparent 200px,
                rgba(0,0,0,0.02) 200px,
                rgba(0,0,0,0.02) 201px
              )`,
            }}
          />
        </div>

        {/* Top molding */}
        <div
          className="relative h-6 z-10"
          style={{
            background: `linear-gradient(180deg,
              #8B6543 0%,
              #A67B5B 40%,
              #7A5A3A 100%)`,
            boxShadow: `0 3px 6px rgba(74, 55, 40, 0.3)`,
          }}
        >
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#6B4F36]" />
          {/* Decorative top edge */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#C4956A]/50" />
        </div>

        {/* Left side panel */}
        <div
          className="absolute left-0 top-6 bottom-5 w-4 z-10"
          style={{
            background: `linear-gradient(90deg,
              #7A5A3A 0%,
              #8B6543 40%,
              #A67B5B 100%)`,
            boxShadow: `inset -2px 0 4px rgba(0,0,0,0.1)`,
          }}
        />

        {/* Right side panel */}
        <div
          className="absolute right-0 top-6 bottom-5 w-4 z-10"
          style={{
            background: `linear-gradient(90deg,
              #A67B5B 0%,
              #8B6543 60%,
              #7A5A3A 100%)`,
            boxShadow: `inset 2px 0 4px rgba(0,0,0,0.1)`,
          }}
        />

        {/* Shelves */}
        <div className="relative z-0 px-4">
          {shelves.map((shelfBooks, shelfIndex) => (
            <Shelf
              key={shelfIndex}
              shelfIndex={shelfIndex}
              isEmpty={shelfBooks.length === 0}
            >
              {shelfBooks.map((book, bookIndex) => (
                <BookSpine
                  key={book.id}
                  book={book}
                  index={bookIndex}
                  onClick={() => router.push(`/book/${book.id}`)}
                />
              ))}
            </Shelf>
          ))}
        </div>

        {/* Bottom base */}
        <div
          className="relative h-5 z-10"
          style={{
            background: `linear-gradient(180deg,
              #7A5A3A 0%,
              #8B6543 30%,
              #6B4F36 100%)`,
            boxShadow: `0 4px 12px rgba(74, 55, 40, 0.35)`,
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#A67B5B]/40" />
        </div>
      </div>
    </motion.div>
  );
}
