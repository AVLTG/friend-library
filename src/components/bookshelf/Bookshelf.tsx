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

interface BookshelfProps {
  books: BookData[];
}

function WoodPanel({
  children,
  className,
  gradient,
  shadow,
}: {
  children?: React.ReactNode;
  className: string;
  gradient: string;
  shadow?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: gradient,
        boxShadow: shadow,
      }}
    >
      {/* Wood grain texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            95deg,
            transparent,
            transparent 12px,
            rgba(255,255,255,0.3) 12px,
            rgba(255,255,255,0.3) 13px
          ), repeating-linear-gradient(
            87deg,
            transparent,
            transparent 28px,
            rgba(255,255,255,0.2) 28px,
            rgba(255,255,255,0.2) 29px
          ), repeating-linear-gradient(
            91deg,
            transparent,
            transparent 60px,
            rgba(0,0,0,0.15) 60px,
            rgba(0,0,0,0.15) 61px
          )`,
        }}
      />
      {children}
    </div>
  );
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
      <WoodPanel
        className="relative h-8 rounded-t-lg z-20 overflow-hidden"
        gradient={`linear-gradient(180deg,
          ${FRAME_LIGHT} 0%,
          ${FRAME_COLOR} 50%,
          ${FRAME_DARK} 100%)`}
        shadow={`0 4px 8px rgba(20, 15, 10, 0.4)`}
      >
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/10" />
        <div className="absolute bottom-2 left-2 right-2 h-[1px] bg-black/20" />
        <div className="absolute bottom-[7px] left-2 right-2 h-[1px] bg-white/8" />
      </WoodPanel>

      {/* Main bookcase body */}
      <div className="relative">
        {/* Left side panel */}
        <WoodPanel
          className="absolute left-0 top-0 bottom-0 w-7 z-20 overflow-hidden"
          gradient={`linear-gradient(90deg,
            ${FRAME_DARKEST} 0%,
            ${FRAME_DARK} 25%,
            ${FRAME_COLOR} 60%,
            ${FRAME_LIGHT} 100%)`}
          shadow="inset -3px 0 8px rgba(0,0,0,0.15)"
        >
          <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-white/8" />
          <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-black/25" />
        </WoodPanel>

        {/* Right side panel */}
        <WoodPanel
          className="absolute right-0 top-0 bottom-0 w-7 z-20 overflow-hidden"
          gradient={`linear-gradient(90deg,
            ${FRAME_LIGHT} 0%,
            ${FRAME_COLOR} 40%,
            ${FRAME_DARK} 75%,
            ${FRAME_DARKEST} 100%)`}
          shadow="inset 3px 0 8px rgba(0,0,0,0.15)"
        >
          <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-white/8" />
          <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-black/25" />
        </WoodPanel>

        {/* Shelves */}
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
