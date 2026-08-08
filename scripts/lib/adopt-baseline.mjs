import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const baselineSchema = {
  books: {
    id: ["TEXT", true, true],
    google_books_id: ["TEXT", false, false],
    title: ["TEXT", true, false],
    authors: ["TEXT", true, false],
    isbn: ["TEXT", false, false],
    description: ["TEXT", false, false],
    cover_url: ["TEXT", false, false],
    page_count: ["INTEGER", false, false],
    published_date: ["TEXT", false, false],
    categories: ["TEXT", false, false],
    spine_color: ["TEXT", true, false],
    added_by: ["TEXT", true, false],
    created_at: ["INTEGER", true, false],
  },
  invite_tokens: {
    id: ["TEXT", true, true],
    token: ["TEXT", true, false],
    created_by: ["TEXT", true, false],
    used_by: ["TEXT", false, false],
    used_at: ["INTEGER", false, false],
    expires_at: ["INTEGER", true, false],
    created_at: ["INTEGER", true, false],
  },
  user_books: {
    id: ["TEXT", true, true],
    user_id: ["TEXT", true, false],
    book_id: ["TEXT", true, false],
    owned: ["INTEGER", true, false, ["false", "0"]],
    read: ["INTEGER", true, false, ["false", "0"]],
    currently_reading: ["INTEGER", true, false, ["false", "0"]],
    annotated: ["INTEGER", true, false, ["false", "0"]],
    rating: ["REAL", false, false],
    review: ["TEXT", false, false],
    created_at: ["INTEGER", true, false],
    updated_at: ["INTEGER", true, false],
  },
  users: {
    id: ["TEXT", true, true],
    username: ["TEXT", true, false],
    first_name: ["TEXT", true, false],
    last_name: ["TEXT", true, false],
    password_hash: ["TEXT", true, false],
    avatar_color: ["TEXT", true, false],
    created_at: ["INTEGER", true, false],
  },
};

const expectedIndexes = {
  books: [["id"]],
  invite_tokens: [["id"], ["token"]],
  user_books: [["id"]],
  users: [["id"], ["username"]],
};

const requiredForeignKeys = {
  books: [["added_by", "users", "id"]],
  invite_tokens: [
    ["created_by", "users", "id"],
    ["used_by", "users", "id"],
  ],
  user_books: [
    ["user_id", "users", "id"],
    ["book_id", "books", "id"],
  ],
};

async function getColumnRows(client, tableName) {
  const result = await client.execute(`PRAGMA table_info('${tableName}')`);
  return result.rows;
}

function normalizeDefault(value) {
  if (value === null || value === undefined) return null;
  return String(value).replace(/^\((.*)\)$/, "$1").toLowerCase();
}

async function verifyColumns(client, tableName, expectedColumns) {
  const rows = await getColumnRows(client, tableName);
  if (rows.length !== Object.keys(expectedColumns).length) {
    throw new Error(`Baseline column count differs for ${tableName}`);
  }

  for (const [columnName, expected] of Object.entries(expectedColumns)) {
    const row = rows.find((candidate) => candidate.name === columnName);
    if (!row) throw new Error(`Required baseline column is missing: ${tableName}.${columnName}`);

    const [type, notNull, primaryKey, defaults] = expected;
    if (
      String(row.type).toUpperCase() !== type ||
      Boolean(row.notnull) !== notNull ||
      Boolean(row.pk) !== primaryKey
    ) {
      throw new Error(`Baseline column definition differs: ${tableName}.${columnName}`);
    }

    const actualDefault = normalizeDefault(row.dflt_value);
    if (defaults) {
      if (!defaults.includes(actualDefault)) {
        throw new Error(`Baseline default differs: ${tableName}.${columnName}`);
      }
    } else if (actualDefault !== null) {
      throw new Error(`Unexpected baseline default: ${tableName}.${columnName}`);
    }
  }
}

async function verifyIndexes(client, tableName, expected) {
  const indexList = await client.execute(`PRAGMA index_list('${tableName}')`);
  if (indexList.rows.length !== expected.length) {
    throw new Error(`Baseline index count differs for ${tableName}`);
  }

  const actualIndexes = [];

  for (const index of indexList.rows) {
    if (Number(index.unique) !== 1 || Number(index.partial) !== 0) {
      throw new Error(`Unexpected baseline index definition for ${tableName}`);
    }

    const details = await client.execute(
      `PRAGMA index_xinfo('${String(index.name)}')`,
    );
    const keyColumns = details.rows.filter((row) => Number(row.key) === 1);
    if (
      keyColumns.some(
        (row) =>
          String(row.coll).toUpperCase() !== "BINARY" || Number(row.desc) !== 0,
      )
    ) {
      throw new Error(`Unexpected index collation or ordering for ${tableName}`);
    }
    actualIndexes.push(keyColumns.map((row) => String(row.name)));
  }

  for (const expectedColumns of expected) {
    const matchIndex = actualIndexes.findIndex(
      (columns) => columns.join("|") === expectedColumns.join("|"),
    );
    if (matchIndex === -1) {
      throw new Error(
        `Required unique index is missing: ${tableName}(${expectedColumns.join(",")})`,
      );
    }
    actualIndexes.splice(matchIndex, 1);
  }

  if (actualIndexes.length > 0) {
    throw new Error(`Unexpected baseline index exists for ${tableName}`);
  }
}

async function verifyForeignKeys(client, tableName, expectedKeys) {
  const result = await client.execute(`PRAGMA foreign_key_list('${tableName}')`);
  if (result.rows.length !== expectedKeys.length) {
    throw new Error(`Baseline foreign-key count differs for ${tableName}`);
  }

  for (const [from, targetTable, to] of expectedKeys) {
    const matches = result.rows.some(
      (row) =>
        row.from === from &&
        row.table === targetTable &&
        row.to === to &&
        String(row.on_update).toUpperCase() === "NO ACTION" &&
        String(row.on_delete).toUpperCase() === "NO ACTION",
    );
    if (!matches) {
      throw new Error(`Required foreign key is missing: ${tableName}.${from}`);
    }
  }
}

export async function verifyBaselineSchema(client) {
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  const tableNames = new Set(tables.rows.map((row) => String(row.name)));

  for (const tableName of Object.keys(baselineSchema)) {
    if (!tableNames.has(tableName)) {
      throw new Error(`Required baseline table is missing: ${tableName}`);
    }
  }

  const userColumns = new Set(
    (await getColumnRows(client, "users")).map((row) => String(row.name)),
  );
  if (userColumns.has("session_version") || tableNames.has("rate_limit_buckets")) {
    throw new Error(
      "Phase 2 schema is already partially present; inspect it before adopting the baseline",
    );
  }

  for (const [tableName, columns] of Object.entries(baselineSchema)) {
    const tableDefinition = await client.execute({
      sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
      args: [tableName],
    });
    const createSql = String(tableDefinition.rows[0]?.sql ?? "");
    if (/\b(CHECK|COLLATE|STRICT)\b|\bWITHOUT\s+ROWID\b/i.test(createSql)) {
      throw new Error(`Unexpected table constraint exists for ${tableName}`);
    }

    await verifyColumns(client, tableName, columns);
    await verifyIndexes(client, tableName, expectedIndexes[tableName]);
    await verifyForeignKeys(
      client,
      tableName,
      requiredForeignKeys[tableName] ?? [],
    );
  }
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

  await verifyBaselineSchema(client);

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
