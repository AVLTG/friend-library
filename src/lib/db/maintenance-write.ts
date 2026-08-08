import { sql } from "drizzle-orm";
import { db } from ".";

export type DatabaseTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export async function maintenanceTransaction<T>(
  operation: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const maintenance = await tx.run(sql`
      SELECT enabled FROM __migration_0004_maintenance
      WHERE enabled = 1 LIMIT 1
    `);
    if (maintenance.rows.length === 0) return operation(tx);

    await tx.run(sql`DELETE FROM __migration_0004_maintenance WHERE enabled = 1`);
    try {
      return await operation(tx);
    } finally {
      await tx.run(sql`
        INSERT INTO __migration_0004_maintenance (enabled) VALUES (1)
      `);
    }
  });
}
