"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Shelf from "./Shelf";
import BookSpine, { type BookData } from "./BookSpine";

// Shelf height: 210px books + 14px plank = 224px per shelf
const SHELF_HEIGHT = 224;
const EXTRA_EMPTY_SHELVES = 2;

// Nav bar / border color
const FRAME_COLOR = "#4A3728";
const FRAME_LIGHT = "#5A4735";
const FRAME_DARK = "#3D2E20";
const FRAME_DARKEST = "#2E2218";
const BACK_COLOR = "#664731";

// Wood grain SVG texture
const woodGrainBg = `url("data:image/svg+xml,%3Csvg width='100' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.03 0.15' numOctaves='4' seed='2'/%3E%3C/filter%3E%3C/defs%3E%3Crect width='100' height='400' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E")`;

interface BookshelfProps {
  books: BookData[];
}

export default function Bookshelf({ books }: BookshelfProps) {
  const router = useRouter();
  const shelvesRef = useRef<HTMLDivElement>(null);
  const [booksPerShelf, setBooksPerShelf] = useState(20);

  // Dynamically measure shelf width and calculate how many books fit
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
    return result;
  }, [books, booksPerShelf]);

  // Content shelves + 2 empty + 1 for the half-visible peek
  const contentShelfCount = shelves.filter((s) => s.length > 0).length;
  const totalRenderedShelves = contentShelfCount + EXTRA_EMPTY_SHELVES + 1;

  while (shelves.length < totalRenderedShelves) {
    shelves.push([]);
  }

  // Height that shows: content + 2 empty + half of next, plus frame
  const innerHeight =
    (contentShelfCount + EXTRA_EMPTY_SHELVES + 0.5) * SHELF_HEIGHT;
  const totalHeight = 32 + innerHeight + 24;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative rounded-t-lg"
      style={{
        height: totalHeight,
        overflow: "hidden",
        boxShadow: `
          0 10px 40px rgba(20, 15, 10, 0.4),
          0 2px 10px rgba(20, 15, 10, 0.2)`,
      }}
    >
      {/* Back panel */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg,
            ${BACK_COLOR} 0%,
            #5C3F2B 50%,
            #543A26 100%)`,
        }}
      >
        {/* Back panel wood texture */}
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 80px,
              rgba(0,0,0,0.04) 80px,
              rgba(0,0,0,0.04) 81px
            ), repeating-linear-gradient(
              90deg,
              transparent,
              transparent 160px,
              rgba(0,0,0,0.03) 160px,
              rgba(0,0,0,0.03) 162px
            )`,
          }}
        />
      </div>

      {/* Top molding */}
      <div
        className="relative h-8 z-10"
        style={{
          background: `linear-gradient(180deg,
            ${FRAME_LIGHT} 0%,
            ${FRAME_COLOR} 50%,
            ${FRAME_DARK} 100%)`,
          boxShadow: `0 4px 8px rgba(20, 15, 10, 0.4)`,
          backgroundImage: woodGrainBg,
          backgroundBlendMode: "overlay",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/8" />
        <div className="absolute bottom-2 left-2 right-2 h-[1px] bg-black/15" />
        <div className="absolute bottom-[7px] left-2 right-2 h-[1px] bg-white/5" />
      </div>

      {/* Left side panel */}
      <div
        className="absolute left-0 top-8 bottom-0 w-7 z-10"
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
        className="absolute right-0 top-8 bottom-0 w-7 z-10"
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

      {/* Shelves */}
      <div ref={shelvesRef} className="relative z-0 px-7">
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
      </div>
    </motion.div>
  );
}
