import { count, sql } from "drizzle-orm";
import { inviteTokens, users } from "./db/schema";
import { maintenanceTransaction } from "./db/maintenance-write";
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
    maintenanceTransaction(async (tx) => {
      const userCount = await tx.select({ count: count() }).from(users).get();
      if (userCount && userCount.count > 0) {
        throw new InitialSetupAlreadyCompletedError();
      }

      await tx.insert(users).values(user);
      await tx.insert(inviteTokens).values(invite);
      await tx.run(sql`
        INSERT INTO __migration_0004_maintenance (enabled) VALUES (1)
      `);
    }),
  );
}
