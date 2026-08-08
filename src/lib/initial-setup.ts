import { count } from "drizzle-orm";
import { db } from "./db";
import { inviteTokens, users } from "./db/schema";

export class InitialSetupAlreadyCompletedError extends Error {}

interface InitialSetupValues {
  user: typeof users.$inferInsert;
  invite: typeof inviteTokens.$inferInsert;
}

export async function createInitialUserAndInvite({
  user,
  invite,
}: InitialSetupValues): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await db.transaction(async (tx) => {
        const userCount = await tx.select({ count: count() }).from(users).get();
        if (userCount && userCount.count > 0) {
          throw new InitialSetupAlreadyCompletedError();
        }

        await tx.insert(users).values(user);
        await tx.insert(inviteTokens).values(invite);
      });
      return;
    } catch (error) {
      const isBusy =
        error instanceof Error &&
        "code" in error &&
        (error as Error & { code?: string }).code === "SQLITE_BUSY";
      if (!isBusy || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}
