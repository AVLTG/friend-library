"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Shelf from "./Shelf";
import BookSpine, { type BookData } from "./BookSpine";

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
    // Always show at least one shelf
    if (result.length === 0) result.push([]);
    return result;
  }, [books, booksPerShelf]);

  return (
    <div className="space-y-8">
      {shelves.map((shelfBooks, shelfIndex) => (
        <Shelf key={shelfIndex} shelfIndex={shelfIndex}>
          {shelfBooks.length === 0 && (
            <div className="flex items-center justify-center w-full h-[200px] text-warm-400 text-sm italic font-serif">
              This shelf is empty... Add some books!
            </div>
          )}
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
  );
}
