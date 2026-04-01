"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Star } from "lucide-react";

export interface BookData {
  id: string;
  title: string;
  authors: string[];
  coverUrl?: string | null;
  spineColor: string;
  pageCount?: number | null;
  averageRating?: number | null;
  owners: Array<{ id: string; firstName: string; avatarColor: string }>;
}

interface BookSpineProps {
  book: BookData;
  index: number;
  onClick: () => void;
}

export default function BookSpine({ book, index, onClick }: BookSpineProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewBelow, setPreviewBelow] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const spineRef = useRef<HTMLDivElement>(null);
  const spineWidth = Math.max(28, Math.min(55, (book.pageCount || 200) / 8));

  const checkPosition = useCallback(() => {
    if (!spineRef.current) return;
    const rect = spineRef.current.getBoundingClientRect();
    setPreviewBelow(rect.top < 320);
  }, []);

  function handleMouseEnter() {
    setIsHovered(true);
    checkPosition();
    hoverTimeout.current = setTimeout(() => setShowPreview(true), 600);
  }

  function handleMouseLeave() {
    setIsHovered(false);
    setShowPreview(false);
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  }

  function lightenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
    const b = Math.min(255, (num & 0x0000ff) + amount);
    return `rgb(${r}, ${g}, ${b})`;
  }

  return (
    <motion.div
      ref={spineRef}
      className="relative flex-shrink-0 cursor-pointer h-[190px]"
      style={{ width: spineWidth }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* The spine itself */}
      <motion.div
        className="relative h-full rounded-sm overflow-hidden"
        style={{
          backgroundColor: book.spineColor,
          width: spineWidth,
        }}
        animate={{
          y: isHovered ? -12 : 0,
          scale: isHovered ? 1.02 : 1,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Cover image — optimized loads fast, then full-res fades in */}
        {book.coverUrl ? (
          <>
            {/* Fast optimized version (shows immediately) */}
            <Image
              src={book.coverUrl}
              alt=""
              fill
              className={`object-cover transition-opacity duration-300 ${
                imageLoaded ? "opacity-0" : "opacity-100"
              }`}
              sizes="100px"
              quality={50}
            />
            {/* Full-res version (fades in when loaded) */}
            <Image
              src={book.coverUrl}
              alt=""
              fill
              className={`object-cover transition-opacity duration-500 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              sizes="200px"
              unoptimized
              onLoad={() => setImageLoaded(true)}
            />
          </>
        ) : null}

        {/* Spine texture/gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: book.coverUrl
              ? `linear-gradient(90deg,
                  rgba(0,0,0,0.3) 0%,
                  rgba(0,0,0,0.1) 20%,
                  rgba(0,0,0,0.05) 50%,
                  rgba(0,0,0,0.1) 80%,
                  rgba(0,0,0,0.35) 100%)`
              : `linear-gradient(90deg,
                  rgba(0,0,0,0.15) 0%,
                  rgba(255,255,255,0.08) 15%,
                  rgba(255,255,255,0.05) 50%,
                  rgba(0,0,0,0.1) 85%,
                  rgba(0,0,0,0.2) 100%)`,
          }}
        />

        {/* Top decoration line (only if no cover) */}
        {!book.coverUrl && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 h-[1px] rounded-full"
            style={{
              width: spineWidth - 10,
              backgroundColor: lightenColor(book.spineColor, 60),
            }}
          />
        )}

        {/* Title on spine */}
        <div
          className="absolute inset-0 flex items-center justify-center px-1"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          <span
            className="text-[10px] font-serif font-bold leading-tight tracking-wide truncate max-h-[85%]"
            style={{
              color: book.coverUrl ? "#fff" : lightenColor(book.spineColor, 140),
              textShadow: book.coverUrl
                ? "0 1px 3px rgba(0,0,0,0.8), 0 0px 6px rgba(0,0,0,0.4)"
                : "none",
            }}
          >
            {book.title}
          </span>
        </div>

        {/* Bottom decoration line (only if no cover) */}
        {!book.coverUrl && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 h-[1px] rounded-full"
            style={{
              width: spineWidth - 10,
              backgroundColor: lightenColor(book.spineColor, 60),
            }}
          />
        )}

        {/* Hover glow */}
        {isHovered && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: `radial-gradient(ellipse at center, rgba(255,255,255,0.15) 0%, transparent 70%)`,
            }}
          />
        )}
      </motion.div>

      {/* Cover Preview Popup */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, y: previewBelow ? -10 : 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: previewBelow ? -10 : 10, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none ${
              previewBelow ? "top-full mt-4" : "bottom-full mb-4"
            }`}
          >
            <div className="card-warm p-3 shadow-xl min-w-[180px]">
              {book.coverUrl ? (
                <div className="relative w-[120px] h-[180px] mx-auto mb-3 rounded-md overflow-hidden shadow-md">
                  <Image
                    src={book.coverUrl}
                    alt={book.title}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                </div>
              ) : (
                <div
                  className="w-[120px] h-[180px] mx-auto mb-3 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: book.spineColor }}
                >
                  <span
                    className="text-xs font-serif text-center px-2"
                    style={{ color: lightenColor(book.spineColor, 140) }}
                  >
                    {book.title}
                  </span>
                </div>
              )}

              <h3 className="font-serif font-bold text-sm text-warm-900 text-center leading-tight">
                {book.title}
              </h3>
              <p className="text-xs text-warm-500 text-center mt-1">
                {book.authors.join(", ")}
              </p>

              {book.averageRating && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span className="text-xs font-medium text-warm-700">
                    {book.averageRating.toFixed(1)}
                  </span>
                </div>
              )}

              {book.owners.length > 0 && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  {book.owners.slice(0, 4).map((owner) => (
                    <div
                      key={owner.id}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                      style={{ backgroundColor: owner.avatarColor }}
                      title={owner.firstName}
                    >
                      {owner.firstName[0]}
                    </div>
                  ))}
                  {book.owners.length > 4 && (
                    <span className="text-[10px] text-warm-500">
                      +{book.owners.length - 4}
                    </span>
                  )}
                </div>
              )}

              <div
                className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-warm-50 border-warm-200 rotate-45 ${
                  previewBelow
                    ? "-top-2 border-l border-t"
                    : "-bottom-2 border-r border-b"
                }`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
