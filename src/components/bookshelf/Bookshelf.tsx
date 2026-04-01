"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Shelf from "./Shelf";
import BookSpine, { type BookData } from "./BookSpine";

const EXTRA_EMPTY_SHELVES = 2;

// Nav bar color for frame
const FRAME_COLOR = "#4A3728";
const FRAME_LIGHT = "#5A4735";
const FRAME_DARK = "#3D2E20";
const FRAME_DARKEST = "#2E2218";

// Wood grain SVG texture
const woodGrainBg = `url("data:image/svg+xml,%3Csvg width='100' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.03 0.15' numOctaves='4' seed='2'/%3E%3C/filter%3E%3C/defs%3E%3Crect width='100' height='400' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E")`;

interface BookshelfProps {
  books: BookData[];
}

export default function Bookshelf({ books }: BookshelfProps) {
  const router = useRouter();
  const shelvesRef = useRef<HTMLDivElement>(null);
  const [booksPerShelf, setBooksPerShelf] = useState(20);

  useEffect(() => {
    if (!shelvesRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      const available = width - 16;
      const avgSlot = 44;
      setBooksPerShelf(Math.max(5, Math.floor(available / avgSlot)));
    });
    observer.observe(shelvesRef.current);
    return () => observer.disconnect();
  }, []);

  const shelves = useMemo(() => {
    const result: BookData[][] = [];
    for (let i = 0; i < books.length; i += booksPerShelf) {
      result.push(books.slice(i, i + booksPerShelf));
    }
    if (result.length === 0) result.push([]);

    // Add empty shelves
    for (let i = 0; i < EXTRA_EMPTY_SHELVES; i++) {
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
      {/* Top molding */}
      <div
        className="relative h-8 rounded-t-lg z-20"
        style={{
          background: `linear-gradient(180deg,
            ${FRAME_LIGHT} 0%,
            ${FRAME_COLOR} 50%,
            ${FRAME_DARK} 100%)`,
          boxShadow: `0 4px 8px rgba(20, 15, 10, 0.4)`,
          backgroundImage: woodGrainBg,
          backgroundBlendMode: "multiply",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/8" />
        <div className="absolute bottom-2 left-2 right-2 h-[1px] bg-black/15" />
        <div className="absolute bottom-[7px] left-2 right-2 h-[1px] bg-white/5" />
      </div>

      {/* Main bookcase body */}
      <div className="relative">
        {/* Left side panel */}
        <div
          className="absolute left-0 top-0 bottom-0 w-7 z-20"
          style={{
            background: `linear-gradient(90deg,
              ${FRAME_DARKEST} 0%,
              ${FRAME_DARK} 25%,
              ${FRAME_COLOR} 60%,
              ${FRAME_LIGHT} 100%)`,
            backgroundImage: woodGrainBg,
            backgroundBlendMode: "overlay",
            boxShadow: `inset -3px 0 8px rgba(0,0,0,0.15)`,
          }}
        >
          <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-white/5" />
          <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-black/20" />
        </div>

        {/* Right side panel */}
        <div
          className="absolute right-0 top-0 bottom-0 w-7 z-20"
          style={{
            background: `linear-gradient(90deg,
              ${FRAME_LIGHT} 0%,
              ${FRAME_COLOR} 40%,
              ${FRAME_DARK} 75%,
              ${FRAME_DARKEST} 100%)`,
            backgroundImage: woodGrainBg,
            backgroundBlendMode: "overlay",
            boxShadow: `inset 3px 0 8px rgba(0,0,0,0.15)`,
          }}
        >
          <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-white/5" />
          <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-black/20" />
        </div>

        {/* Shelves — no overflow hidden so popups can escape */}
        <div ref={shelvesRef} className="relative px-7">
          {shelves.map((shelfBooks, shelfIndex) => (
            <Shelf key={shelfIndex}>
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

          {/* Half-visible peek shelf */}
          <div className="h-[112px] overflow-hidden">
            <Shelf>{null}</Shelf>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
