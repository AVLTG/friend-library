"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { getSpineWidth } from "./spine-width";

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
  href: string;
}

interface PreviewPosition {
  left: number;
  top: number;
  width: number;
  below: boolean;
}

export default function BookSpine({ book, index, href }: BookSpineProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<PreviewPosition>({
    left: 12,
    top: 12,
    width: 180,
    below: true,
  });
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const spineRef = useRef<HTMLAnchorElement>(null);
  const previewId = useId();
  const spineWidth = getSpineWidth(book.pageCount);
  const active = isHovered || isFocused;

  const checkPosition = useCallback(() => {
    if (!spineRef.current) return;
    const rect = spineRef.current.getBoundingClientRect();
    const gutter = 12;
    const width = Math.min(220, window.innerWidth - gutter * 2);
    const estimatedHeight = book.coverUrl ? Math.min(300, window.innerHeight - 24) : 130;
    const spaceBelow = window.innerHeight - rect.bottom - gutter;
    const spaceAbove = rect.top - gutter;
    const below = spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove;
    const centeredLeft = rect.left + rect.width / 2 - width / 2;
    const left = Math.max(
      gutter,
      Math.min(centeredLeft, window.innerWidth - width - gutter),
    );
    const top = below
      ? Math.min(rect.bottom + gutter, window.innerHeight - estimatedHeight - gutter)
      : Math.max(gutter, rect.top - estimatedHeight - gutter);

    setPreviewPosition({ left, top: Math.max(gutter, top), width, below });
  }, [book.coverUrl]);

  useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (!showPreview) return;
    checkPosition();
    window.addEventListener("resize", checkPosition);
    window.addEventListener("scroll", checkPosition, true);
    return () => {
      window.removeEventListener("resize", checkPosition);
      window.removeEventListener("scroll", checkPosition, true);
    };
  }, [checkPosition, showPreview]);

  function showKeyboardPreview() {
    setIsFocused(true);
    checkPosition();
    setShowPreview(true);
  }

  function handleMouseEnter() {
    setIsHovered(true);
    hoverTimeout.current = setTimeout(() => {
      checkPosition();
      setShowPreview(true);
    }, 600);
  }

  function handleMouseLeave() {
    setIsHovered(false);
    if (!isFocused) setShowPreview(false);
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  }

  function hideKeyboardPreview() {
    setIsFocused(false);
    if (!isHovered) setShowPreview(false);
  }

  function lightenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
    const b = Math.min(255, (num & 0x0000ff) + amount);
    return `rgb(${r}, ${g}, ${b})`;
  }

  const accessibleName = book.authors.length
    ? `${book.title} by ${book.authors.join(", ")}`
    : book.title;
  const previewDescription = [
    book.averageRating ? `${book.averageRating.toFixed(1)} out of 5 stars` : "",
    book.owners.length
      ? `Owned by ${book.owners.map((owner) => owner.firstName).join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <Link
      ref={spineRef}
      href={href}
      aria-label={accessibleName}
      aria-describedby={showPreview && previewDescription ? previewId : undefined}
      className="relative h-[190px] flex-shrink-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-warm-800"
      style={{ width: spineWidth }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={showKeyboardPreview}
      onBlur={hideKeyboardPreview}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setShowPreview(false);
        }
      }}
    >
      <motion.div
        className="relative h-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03, duration: 0.3 }}
      >
        <motion.div
          className="relative h-full overflow-hidden rounded-sm"
          style={{ backgroundColor: book.spineColor, width: spineWidth }}
          animate={{ y: active ? -12 : 0, scale: active ? 1.02 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {book.coverUrl ? (
            <Image
              src={book.coverUrl}
              alt=""
              fill
              className="object-cover"
              sizes="55px"
              quality={50}
            />
          ) : null}

          <div
            className="absolute inset-0"
            style={{
              background: book.coverUrl
                ? "linear-gradient(90deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 20%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.1) 80%, rgba(0,0,0,0.35) 100%)"
                : "linear-gradient(90deg, rgba(0,0,0,0.15) 0%, rgba(255,255,255,0.08) 15%, rgba(255,255,255,0.05) 50%, rgba(0,0,0,0.1) 85%, rgba(0,0,0,0.2) 100%)",
            }}
          />

          {!book.coverUrl && (
            <div
              className="absolute left-1/2 top-3 h-px -translate-x-1/2 rounded-full"
              style={{
                width: spineWidth - 10,
                backgroundColor: lightenColor(book.spineColor, 60),
              }}
            />
          )}

          <div
            className="absolute inset-0 flex items-center justify-center px-1"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            <span
              className="max-h-[85%] truncate font-serif text-[10px] font-bold leading-tight tracking-wide"
              style={{
                color: book.coverUrl ? "#fff" : lightenColor(book.spineColor, 140),
                textShadow: book.coverUrl
                  ? "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.4)"
                  : "none",
              }}
            >
              {book.title}
            </span>
          </div>

          {!book.coverUrl && (
            <div
              className="absolute bottom-3 left-1/2 h-px -translate-x-1/2 rounded-full"
              style={{
                width: spineWidth - 10,
                backgroundColor: lightenColor(book.spineColor, 60),
              }}
            />
          )}
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showPreview && (
          <motion.div
            id={previewId}
            role="tooltip"
            aria-label={previewDescription || undefined}
            initial={{ opacity: 0, y: previewPosition.below ? -6 : 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none fixed z-[60]"
            style={{
              left: previewPosition.left,
              top: previewPosition.top,
              width: previewPosition.width,
            }}
          >
            <div aria-hidden="true" className="max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-xl border border-warm-500 bg-warm-50 p-3 shadow-2xl">
              {book.coverUrl && (
                <div className="relative mx-auto mb-3 h-[clamp(100px,25vh,180px)] w-[120px] overflow-hidden rounded-md shadow-md">
                  <Image
                    src={book.coverUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                </div>
              )}
              <h3 className="line-clamp-2 text-center font-serif text-sm font-bold leading-tight text-warm-900">
                {book.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-center text-xs text-warm-700">
                {book.authors.join(", ")}
              </p>
              {book.averageRating && (
                <div className="mt-2 flex items-center justify-center gap-1">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-600" />
                  <span className="text-xs font-medium text-warm-700">
                    {book.averageRating.toFixed(1)} out of 5
                  </span>
                </div>
              )}
              {book.owners.length > 0 && (
                <p className="mt-2 text-center text-[11px] text-warm-700">
                  Owned by {book.owners.map((owner) => owner.firstName).join(", ")}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Link>
  );
}
