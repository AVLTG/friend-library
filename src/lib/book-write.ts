import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { bookGoogleIds, books, userBooks } from "./db/schema";
import { withSqliteBusyRetry } from "./db/transaction";
import { isSqliteUniqueConstraint } from "./db/errors";

export class BookIdentityConflictError extends Error {
  constructor() {
    super("The Google Books ID and ISBN match different library editions");
  }
}

export type CreateOrAttachBookResult = {
  bookId: string;
  bookCreated: boolean;
  relationshipCreated: boolean;
  owned: true;
};

let bookWriteQueue: Promise<void> = Promise.resolve();

async function serializeBookWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = bookWriteQueue.then(operation, operation);
  bookWriteQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function createBookWithOwner(
  book: typeof books.$inferInsert,
  owner: typeof userBooks.$inferInsert,
): Promise<void> {
  await withSqliteBusyRetry(() =>
    db.transaction(async (tx) => {
      await tx.insert(books).values(book);
      await tx.insert(userBooks).values(owner);
    }),
  );
}

export async function createOrAttachBook(
  book: typeof books.$inferInsert,
  owner: typeof userBooks.$inferInsert,
): Promise<CreateOrAttachBookResult> {
  return serializeBookWrite(async () => {
    const operation = () =>
      db.transaction(async (tx) => {
      const googleMatch = book.googleBooksId
        ? await tx
            .select({
              id: books.id,
              googleBooksId: books.googleBooksId,
              isbn: books.isbn,
            })
            .from(bookGoogleIds)
            .innerJoin(books, eq(bookGoogleIds.bookId, books.id))
            .where(eq(bookGoogleIds.googleBooksId, book.googleBooksId))
            .get()
        : undefined;
      const isbnMatch = book.isbn
        ? await tx
            .select({
              id: books.id,
              googleBooksId: books.googleBooksId,
              isbn: books.isbn,
            })
            .from(books)
            .where(eq(books.isbn, book.isbn))
            .get()
        : undefined;
      if (googleMatch && isbnMatch && googleMatch.id !== isbnMatch.id) {
        throw new BookIdentityConflictError();
      }
      if (
        googleMatch?.isbn &&
        book.isbn &&
        googleMatch.isbn !== book.isbn
      ) {
        throw new BookIdentityConflictError();
      }

      const existing = googleMatch || isbnMatch;
      if (!existing) {
        await tx.insert(books).values(book);
        if (book.googleBooksId) {
          await tx.insert(bookGoogleIds).values({
            googleBooksId: book.googleBooksId,
            bookId: book.id,
          });
        }
        await tx.insert(userBooks).values(owner);
        return {
          bookId: book.id,
          bookCreated: true,
          relationshipCreated: true,
          owned: true,
        } as const;
      }

      const relationship = await tx
        .select({ id: userBooks.id })
        .from(userBooks)
        .where(
          and(
            eq(userBooks.userId, owner.userId),
            eq(userBooks.bookId, existing.id),
          ),
        )
        .get();
      if (book.googleBooksId && !googleMatch) {
        await tx.insert(bookGoogleIds).values({
          googleBooksId: book.googleBooksId,
          bookId: existing.id,
        });
        if (!existing.googleBooksId) {
          await tx
            .update(books)
            .set({ googleBooksId: book.googleBooksId })
            .where(eq(books.id, existing.id));
        }
      }
      if (book.isbn && !existing.isbn) {
        await tx
          .update(books)
          .set({ isbn: book.isbn })
          .where(eq(books.id, existing.id));
      }
      await tx
        .insert(userBooks)
        .values({ ...owner, bookId: existing.id, owned: true })
        .onConflictDoUpdate({
          target: [userBooks.userId, userBooks.bookId],
          set: { owned: true, updatedAt: new Date() },
        });

      return {
        bookId: existing.id,
        bookCreated: false,
        relationshipCreated: !relationship,
        owned: true,
      } as const;
      });

    try {
      return await withSqliteBusyRetry(operation);
    } catch (error) {
      const isIdentityRace = isSqliteUniqueConstraint(error, [
        "books.google_books_id",
        "books.isbn",
        "book_google_ids.google_books_id",
      ]);
      if (!isIdentityRace) throw error;
      return withSqliteBusyRetry(operation);
    }
  });
}
