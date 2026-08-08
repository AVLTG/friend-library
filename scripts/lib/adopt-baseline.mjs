import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const requiredColumns = {
  books: ["id", "title", "authors", "spine_color", "added_by", "created_at"],
  invite_tokens: ["id", "token", "created_by", "expires_at", "created_at"],
  user_books: ["id", "user_id", "book_id", "owned", "read", "updated_at"],
  users: ["id", "username", "password_hash", "avatar_color", "created_at"],
};

async function getColumns(client, tableName) {
  const result = await client.execute(`PRAGMA table_info('${tableName}')`);
  return new Set(result.rows.map((row) => String(row.name)));
}

export async function adoptBaseline(client, projectRoot) {
  const baselinePath = resolve(projectRoot, "drizzle/0000_baseline.sql");
  const journalPath = resolve(projectRoot, "drizzle/meta/_journal.json");
  const [baselineSql, journalText] = await Promise.all([
    readFile(baselinePath, "utf8"),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalText);
  const baselineEntry = journal.entries.find((entry) => entry.idx === 0);
  if (!baselineEntry) throw new Error("Baseline migration journal entry is missing");

  const baselineHash = createHash("sha256").update(baselineSql).digest("hex");
  const migrationTable = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
  );

  if (migrationTable.rows.length > 0) {
    const migrations = await client.execute(
      "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at",
    );
    const matchingBaseline = migrations.rows.some(
      (row) =>
        row.hash === baselineHash &&
        Number(row.created_at) === Number(baselineEntry.when),
    );
    if (matchingBaseline) return "already-adopted";
    if (migrations.rows.length > 0) {
      throw new Error("Migration history exists but does not contain this baseline");
    }
  }

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  const tableNames = new Set(tables.rows.map((row) => String(row.name)));

  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    if (!tableNames.has(tableName)) {
      throw new Error(`Required baseline table is missing: ${tableName}`);
    }
    const actualColumns = await getColumns(client, tableName);
    for (const column of columns) {
      if (!actualColumns.has(column)) {
        throw new Error(`Required baseline column is missing: ${tableName}.${column}`);
      }
    }
  }

  const userColumns = await getColumns(client, "users");
  if (userColumns.has("session_version") || tableNames.has("rate_limit_buckets")) {
    throw new Error(
      "Phase 2 schema is already partially present; inspect it before adopting the baseline",
    );
  }

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    );
    INSERT INTO __drizzle_migrations (hash, created_at)
    VALUES ('${baselineHash}', ${Number(baselineEntry.when)});
  `);

  return "adopted";
}
