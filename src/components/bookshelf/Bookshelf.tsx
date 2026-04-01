"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Shelf from "./Shelf";
import BookSpine, { type BookData } from "./BookSpine";

// Shelf height: 210px books + 14px plank = 224px per shelf
const SHELF_HEIGHT = 224;
const EXTRA_EMPTY_SHELVES = 2;

// Wood grain SVG as inline data URI for border texture
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
      // Available width minus shelf padding (px-2 = 8px each side)
      const available = width - 16;
      // Average spine width ~42px (range 28-55) plus 2px gap
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

  // Content shelves + 2 empty + half of next empty visible
  const contentShelfCount = shelves.filter((s) => s.length > 0).length;
  const totalRenderedShelves = contentShelfCount + EXTRA_EMPTY_SHELVES + 1;

  // Pad shelves array with empty rows
  while (shelves.length < totalRenderedShelves) {
    shelves.push([]);
  }

  // Max visible height: content shelves + 2 full empty + half of next
  // Plus top bar (32px) + bottom base (24px)
  const maxVisibleHeight =
    32 + (contentShelfCount + EXTRA_EMPTY_SHELVES + 0.5) * SHELF_HEIGHT + 24;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-lg"
      style={{
        maxHeight: maxVisibleHeight,
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
            #5F4E38 0%,
            #55452F 30%,
            #4D3F2A 60%,
            #463924 100%)`,
        }}
      >
        {/* Back panel wood texture */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 80px,
              rgba(0,0,0,0.05) 80px,
              rgba(0,0,0,0.05) 81px
            ), repeating-linear-gradient(
              90deg,
              transparent,
              transparent 160px,
              rgba(0,0,0,0.03) 160px,
              rgba(0,0,0,0.03) 162px
            ), repeating-linear-gradient(
              0deg,
              transparent,
              transparent 200px,
              rgba(255,255,255,0.02) 200px,
              rgba(255,255,255,0.02) 203px
            )`,
          }}
        />
      </div>

      {/* Top molding */}
      <div
        className="relative h-8 z-10"
        style={{
          background: `linear-gradient(180deg,
            #3E3020 0%,
            #322B22 50%,
            #2A231A 100%)`,
          boxShadow: `0 4px 8px rgba(20, 15, 10, 0.4)`,
          backgroundImage: woodGrainBg,
          backgroundBlendMode: "overlay",
        }}
      >
        {/* Top highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-[#5A4A38]/60" />
        {/* Decorative groove */}
        <div className="absolute bottom-2 left-2 right-2 h-[1px] bg-[#1A150F]/30" />
        <div className="absolute bottom-[7px] left-2 right-2 h-[1px] bg-[#5A4A38]/20" />
      </div>

      {/* Left side panel */}
      <div
        className="absolute left-0 top-8 bottom-6 w-7 z-10"
        style={{
          background: `linear-gradient(90deg,
            #2A231A 0%,
            #322B22 30%,
            #3E3020 70%,
            #4A3A28 100%)`,
          backgroundImage: woodGrainBg,
          backgroundBlendMode: "overlay",
          boxShadow: `inset -3px 0 8px rgba(0,0,0,0.2)`,
        }}
      >
        {/* Inner edge highlight */}
        <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-[#5A4A38]/20" />
        {/* Outer edge shadow */}
        <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-[#1A150F]/40" />
      </div>

      {/* Right side panel */}
      <div
        className="absolute right-0 top-8 bottom-6 w-7 z-10"
        style={{
          background: `linear-gradient(90deg,
            #4A3A28 0%,
            #3E3020 30%,
            #322B22 70%,
            #2A231A 100%)`,
          backgroundImage: woodGrainBg,
          backgroundBlendMode: "overlay",
          boxShadow: `inset 3px 0 8px rgba(0,0,0,0.2)`,
        }}
      >
        {/* Inner edge highlight */}
        <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-[#5A4A38]/20" />
        {/* Outer edge shadow */}
        <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-[#1A150F]/40" />
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

      {/* Bottom base */}
      <div
        className="relative h-6 z-10"
        style={{
          background: `linear-gradient(180deg,
            #3E3020 0%,
            #322B22 40%,
            #2A231A 100%)`,
          boxShadow: `0 6px 16px rgba(20, 15, 10, 0.5)`,
          backgroundImage: woodGrainBg,
          backgroundBlendMode: "overlay",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-[#5A4A38]/30" />
      </div>
    </motion.div>
  );
}
