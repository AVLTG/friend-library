import { db } from "./db";
import { books, userBooks } from "./db/schema";
import { withSqliteBusyRetry } from "./db/transaction";

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
