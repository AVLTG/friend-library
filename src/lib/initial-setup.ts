import { count } from "drizzle-orm";
import { db } from "./db";
import { inviteTokens, users } from "./db/schema";
import { withSqliteBusyRetry } from "./db/transaction";

export class InitialSetupAlreadyCompletedError extends Error {}

interface InitialSetupValues {
  user: typeof users.$inferInsert;
  invite: typeof inviteTokens.$inferInsert;
}

export async function createInitialUserAndInvite({
  user,
  invite,
}: InitialSetupValues): Promise<void> {
  await withSqliteBusyRetry(() =>
    db.transaction(async (tx) => {
      const userCount = await tx.select({ count: count() }).from(users).get();
      if (userCount && userCount.count > 0) {
        throw new InitialSetupAlreadyCompletedError();
      }

      await tx.insert(users).values(user);
      await tx.insert(inviteTokens).values(invite);
    }),
  );
}
