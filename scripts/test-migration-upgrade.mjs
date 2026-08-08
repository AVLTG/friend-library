import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { adoptBaseline } from "./lib/adopt-baseline.mjs";

const projectRoot = process.cwd();
const databasePath = resolve(projectRoot, ".test/migration-upgrade.db");
const orphanDatabasePath = resolve(projectRoot, ".test/migration-orphan.db");
const databaseUrl = pathToFileURL(databasePath).href;
const migrationsFolder = resolve(projectRoot, "drizzle");

async function verifyOrphanedUpgradeIsRejected() {
  await Promise.all([
    rm(orphanDatabasePath, { force: true }),
    rm(`${orphanDatabasePath}-shm`, { force: true }),
    rm(`${orphanDatabasePath}-wal`, { force: true }),
  ]);

  const orphanClient = createClient({
    url: pathToFileURL(orphanDatabasePath).href,
  });
  try {
    const baseline = await readFile(
      resolve(projectRoot, "drizzle/0000_baseline.sql"),
      "utf8",
    );
    await orphanClient.executeMultiple(
      baseline.replaceAll("--> statement-breakpoint", ""),
    );
    await orphanClient.execute("PRAGMA foreign_keys = OFF");
    await orphanClient.execute(`INSERT INTO user_books
      (id, user_id, book_id, created_at, updated_at)
      VALUES ('Z12345678901234567890', 'missing-user', 'missing-book', 1, 1)`);
    await adoptBaseline(orphanClient, projectRoot);

    let rejected = false;
    try {
      await migrate(drizzle(orphanClient), { migrationsFolder });
    } catch (error) {
      rejected = /constraint/i.test(String(error));
    }
    if (!rejected) {
      throw new Error("Integrity migration accepted orphaned legacy data");
    }

    const orphan = await orphanClient.execute(
      "SELECT COUNT(*) AS count FROM user_books WHERE id = 'Z12345678901234567890'",
    );
    const roleColumn = await orphanClient.execute(
      "SELECT COUNT(*) AS count FROM pragma_table_info('users') WHERE name = 'role'",
    );
    const migrationRecord = await orphanClient.execute(
      "SELECT COUNT(*) AS count FROM __drizzle_migrations WHERE created_at = 1786170934951",
    );
    const guardTable = await orphanClient.execute(
      `SELECT COUNT(*) AS count FROM sqlite_master
       WHERE type = 'table' AND name = '__migration_0003_integrity_guard'`,
    );
    if (
      Number(orphan.rows[0]?.count) !== 1 ||
      Number(roleColumn.rows[0]?.count) !== 0 ||
      Number(migrationRecord.rows[0]?.count) !== 0 ||
      Number(guardTable.rows[0]?.count) !== 0
    ) {
      throw new Error("Rejected integrity migration was not rolled back cleanly");
    }
  } finally {
    orphanClient.close();
    await Promise.all([
      rm(orphanDatabasePath, { force: true }),
      rm(`${orphanDatabasePath}-shm`, { force: true }),
      rm(`${orphanDatabasePath}-wal`, { force: true }),
    ]);
  }
}

await verifyOrphanedUpgradeIsRejected();

await mkdir(dirname(databasePath), { recursive: true });
await Promise.all([
  rm(databasePath, { force: true }),
  rm(`${databasePath}-shm`, { force: true }),
  rm(`${databasePath}-wal`, { force: true }),
]);

const client = createClient({ url: databaseUrl });
try {
  const baseline = await readFile(
    resolve(projectRoot, "drizzle/0000_baseline.sql"),
    "utf8",
  );
  await client.executeMultiple(baseline.replaceAll("--> statement-breakpoint", ""));

  await client.execute("ALTER TABLE user_books DROP COLUMN review");
  let malformedSchemaRejected = false;
  try {
    await adoptBaseline(client, projectRoot);
  } catch (error) {
    malformedSchemaRejected = /column/.test(String(error));
  }
  if (!malformedSchemaRejected) {
    throw new Error("Baseline adoption accepted a schema with a missing column");
  }
  await client.execute("ALTER TABLE user_books ADD COLUMN review text");

  await client.execute(
    "CREATE UNIQUE INDEX unexpected_review_unique ON user_books(review)",
  );
  let extraIndexRejected = false;
  try {
    await adoptBaseline(client, projectRoot);
  } catch (error) {
    extraIndexRejected = /index/.test(String(error));
  }
  if (!extraIndexRejected) {
    throw new Error("Baseline adoption accepted an extra unique index");
  }
  await client.execute("DROP INDEX unexpected_review_unique");

  await client.execute("PRAGMA foreign_keys = ON");
  await client.batch(
    [
      {
        sql: `INSERT INTO users
          (id, username, first_name, last_name, password_hash, avatar_color, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "A12345678901234567890",
          "existing-admin",
          "Existing",
          "Admin",
          "hash",
          "#123456",
          1_000,
        ],
      },
      {
        sql: `INSERT INTO users
          (id, username, first_name, last_name, password_hash, avatar_color, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "B12345678901234567890",
          "existing-member",
          "Existing",
          "Member",
          "hash",
          "#654321",
          2_000,
        ],
      },
      {
        sql: `INSERT INTO books
          (id, google_books_id, title, authors, isbn, spine_color, added_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "C12345678901234567890",
          "google-existing",
          "Existing Book",
          '["Existing Author"]',
          "9781234567890",
          "#123456",
          "A12345678901234567890",
          3_000,
        ],
      },
      {
        sql: `INSERT INTO user_books
          (id, user_id, book_id, owned, read, currently_reading, annotated, rating, review, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "D12345678901234567890",
          "A12345678901234567890",
          "C12345678901234567890",
          1,
          1,
          0,
          0,
          3.5,
          "Older review",
          4_000,
          5_000,
        ],
      },
      {
        sql: `INSERT INTO user_books
          (id, user_id, book_id, owned, read, currently_reading, annotated, rating, review, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "E12345678901234567890",
          "A12345678901234567890",
          "C12345678901234567890",
          0,
          0,
          2,
          9,
          null,
          null,
          4_500,
          6_000,
        ],
      },
      {
        sql: `INSERT INTO user_books
          (id, user_id, book_id, owned, read, currently_reading, annotated, rating, review, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "F12345678901234567890",
          "B12345678901234567890",
          "C12345678901234567890",
          1,
          0,
          0,
          0,
          7,
          null,
          4_000,
          5_000,
        ],
      },
      {
        sql: `INSERT INTO invite_tokens
          (id, token, created_by, used_by, used_at, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "G12345678901234567890",
          "ABCD2345",
          "A12345678901234567890",
          "B12345678901234567890",
          7_000,
          8_000,
          6_000,
        ],
      },
    ],
    "write",
  );

  const adoption = await adoptBaseline(client, projectRoot);
  if (adoption !== "adopted") throw new Error("Fresh legacy schema was not adopted");

  await migrate(drizzle(client), { migrationsFolder });

  const migratedUsers = await client.execute(
    "SELECT username, role, session_version FROM users ORDER BY created_at, id",
  );
  if (
    migratedUsers.rows[0]?.username !== "existing-admin" ||
    migratedUsers.rows[0]?.role !== "admin" ||
    Number(migratedUsers.rows[0]?.session_version) !== 0 ||
    migratedUsers.rows[1]?.username !== "existing-member" ||
    migratedUsers.rows[1]?.role !== "member"
  ) {
    throw new Error("Existing users were not preserved and assigned roles correctly");
  }

  const limiterTable = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rate_limit_buckets'",
  );
  if (limiterTable.rows.length !== 1) {
    throw new Error("Rate-limit table was not created during migration");
  }

  const relationships = await client.execute(
    `SELECT user_id, owned, read, currently_reading, annotated, rating, review, created_at, updated_at
     FROM user_books ORDER BY user_id`,
  );
  const merged = relationships.rows[0];
  if (
    relationships.rows.length !== 2 ||
    merged?.user_id !== "A12345678901234567890" ||
    Number(merged?.owned) !== 1 ||
    Number(merged?.read) !== 0 ||
    Number(merged?.currently_reading) !== 1 ||
    Number(merged?.annotated) !== 1 ||
    merged?.rating !== null ||
    merged?.review !== null ||
    Number(merged?.created_at) !== 4_000 ||
    Number(merged?.updated_at) !== 6_000
  ) {
    throw new Error("Legacy relationships were not consolidated deterministically");
  }

  async function expectConstraint(sql, label) {
    try {
      await client.execute(sql);
    } catch (error) {
      if (/constraint|unique/i.test(String(error))) return;
      throw error;
    }
    throw new Error(`${label} was not enforced`);
  }

  await expectConstraint(
    `INSERT INTO user_books
      (id, user_id, book_id, created_at, updated_at)
      VALUES ('H12345678901234567890', 'A12345678901234567890', 'C12345678901234567890', 1, 1)`,
    "Relationship uniqueness",
  );
  await expectConstraint(
    `UPDATE user_books SET read = 1, currently_reading = 1
     WHERE user_id = 'A12345678901234567890' AND book_id = 'C12345678901234567890'`,
    "Reading-state exclusion",
  );
  await expectConstraint(
    `UPDATE user_books SET owned = 2
     WHERE user_id = 'A12345678901234567890' AND book_id = 'C12345678901234567890'`,
    "Boolean domain",
  );
  await expectConstraint(
    `UPDATE user_books SET rating = 4.2
     WHERE user_id = 'A12345678901234567890' AND book_id = 'C12345678901234567890'`,
    "Rating domain",
  );
  await expectConstraint(
    "UPDATE users SET role = 'owner' WHERE id = 'A12345678901234567890'",
    "Role domain",
  );
  await expectConstraint(
    `INSERT INTO invite_tokens
      (id, token, created_by, used_by, expires_at, created_at)
      VALUES ('N12345678901234567890', 'USED2345', 'A12345678901234567890', 'B12345678901234567890', 20, 10)`,
    "Invite usage state",
  );

  const expectedIndexes = {
    books_added_by_idx: "create index books_added_by_idx on books (added_by)",
    books_google_books_id_idx:
      "create index books_google_books_id_idx on books (google_books_id)",
    books_isbn_idx: "create index books_isbn_idx on books (isbn)",
    invite_tokens_created_by_idx:
      "create index invite_tokens_created_by_idx on invite_tokens (created_by)",
    invite_tokens_used_by_idx:
      "create index invite_tokens_used_by_idx on invite_tokens (used_by)",
    user_books_book_id_idx:
      "create index user_books_book_id_idx on user_books (book_id)",
    user_books_currently_reading_idx:
      "create index user_books_currently_reading_idx on user_books (book_id,user_id) where user_books.currently_reading = 1",
    user_books_user_book_unique:
      "create unique index user_books_user_book_unique on user_books (user_id,book_id)",
  };
  const indexes = await client.execute(
    `SELECT name, sql
     FROM sqlite_master
     WHERE type = 'index' AND name IN (${Object.keys(expectedIndexes).map(() => "?").join(",")})`,
    Object.keys(expectedIndexes),
  );
  const normalizeSql = (sql) =>
    String(sql).replaceAll(/[`"]+/g, "").replaceAll(/\s+/g, " ").trim().toLowerCase();
  const actualIndexes = new Map(
    indexes.rows.map((row) => [String(row.name), normalizeSql(row.sql)]),
  );
  for (const [name, expectedSql] of Object.entries(expectedIndexes)) {
    if (actualIndexes.get(name) !== expectedSql) {
      throw new Error(`Integrity index ${name} has an unexpected definition`);
    }
  }

  await client.batch(
    [
      `INSERT INTO users
        (id, username, first_name, last_name, password_hash, avatar_color, role, session_version, created_at)
        VALUES ('J12345678901234567890', 'cascade-member', 'Cascade', 'Member', 'hash', '#123456', 'member', 0, 9)`,
      `INSERT INTO user_books
        (id, user_id, book_id, created_at, updated_at)
        VALUES ('K12345678901234567890', 'J12345678901234567890', 'C12345678901234567890', 9, 9)`,
      `DELETE FROM users WHERE id = 'J12345678901234567890'`,
    ],
    "write",
  );
  const userCascade = await client.execute(
    "SELECT COUNT(*) AS count FROM user_books WHERE id = 'K12345678901234567890'",
  );
  if (Number(userCascade.rows[0]?.count) !== 0) {
    throw new Error("User relationship cascade was not enforced");
  }

  await client.execute("DELETE FROM books WHERE id = 'C12345678901234567890'");
  const bookCascade = await client.execute(
    "SELECT COUNT(*) AS count FROM user_books WHERE book_id = 'C12345678901234567890'",
  );
  if (Number(bookCascade.rows[0]?.count) !== 0) {
    throw new Error("Book relationship cascade was not enforced");
  }

  await client.batch(
    [
      `INSERT INTO users
        (id, username, first_name, last_name, password_hash, avatar_color, role, session_version, created_at)
        VALUES ('L12345678901234567890', 'invite-creator', 'Invite', 'Creator', 'hash', '#123456', 'member', 0, 10)`,
      `INSERT INTO invite_tokens
        (id, token, created_by, expires_at, created_at)
        VALUES ('M12345678901234567890', 'WXYZ6789', 'L12345678901234567890', 20, 10)`,
      `DELETE FROM users WHERE id = 'L12345678901234567890'`,
    ],
    "write",
  );
  const inviteCascade = await client.execute(
    "SELECT COUNT(*) AS count FROM invite_tokens WHERE id = 'M12345678901234567890'",
  );
  if (Number(inviteCascade.rows[0]?.count) !== 0) {
    throw new Error("Created invite cascade was not enforced");
  }

  const foreignKeyCheck = await client.execute("PRAGMA foreign_key_check");
  if (foreignKeyCheck.rows.length !== 0) {
    throw new Error("Foreign-key violations remain after migration");
  }

  console.log("Existing-database migration upgrade passed");
} finally {
  client.close();
  await Promise.all([
    rm(databasePath, { force: true }),
    rm(`${databasePath}-shm`, { force: true }),
    rm(`${databasePath}-wal`, { force: true }),
  ]);
}
