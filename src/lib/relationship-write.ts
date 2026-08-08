import { and, eq } from "drizzle-orm";
import { generateId } from "./auth";
import { db } from "./db";
import { books, userBooks } from "./db/schema";
import { withSqliteBusyRetry } from "./db/transaction";
import {
  resolveRelationshipState,
  type RelationshipChanges,
} from "./relationship-state";

export class RelationshipBookNotFoundError extends Error {}

export async function updateRelationship(
  userId: string,
  bookId: string,
  changes: RelationshipChanges,
) {
  return withSqliteBusyRetry(() =>
    db.transaction(async (tx) => {
      const book = await tx
        .select({ id: books.id })
        .from(books)
        .where(eq(books.id, bookId))
        .get();
      if (!book) throw new RelationshipBookNotFoundError();

      const current = await tx
        .select()
        .from(userBooks)
        .where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
        .get();
      const next = resolveRelationshipState(current ?? null, changes);
      const updatedAt = new Date();

      await tx
        .insert(userBooks)
        .values({
          id: generateId(),
          userId,
          bookId,
          ...next,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: [userBooks.userId, userBooks.bookId],
          set: { ...next, updatedAt },
        });

      const relationship = await tx
        .select()
        .from(userBooks)
        .where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
        .get();
      if (!relationship) throw new Error("Relationship update did not persist");
      return relationship;
    }),
  );
}
