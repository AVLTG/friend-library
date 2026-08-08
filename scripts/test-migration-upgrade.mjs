import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { adoptBaseline } from "./lib/adopt-baseline.mjs";

const projectRoot = process.cwd();
const databasePath = resolve(projectRoot, ".test/migration-upgrade.db");
const databaseUrl = pathToFileURL(databasePath).href;
const migrationsFolder = resolve(projectRoot, "drizzle");

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

  await client.execute({
    sql: `INSERT INTO users
      (id, username, first_name, last_name, password_hash, avatar_color, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      "A12345678901234567890",
      "existing-user",
      "Existing",
      "User",
      "hash",
      "#123456",
      Date.now(),
    ],
  });

  const adoption = await adoptBaseline(client, projectRoot);
  if (adoption !== "adopted") throw new Error("Fresh legacy schema was not adopted");

  await migrate(drizzle(client), { migrationsFolder });

  const user = await client.execute(
    "SELECT username, session_version FROM users WHERE id = 'A12345678901234567890'",
  );
  if (
    user.rows[0]?.username !== "existing-user" ||
    Number(user.rows[0]?.session_version) !== 0
  ) {
    throw new Error("Existing user data was not preserved during migration");
  }

  const limiterTable = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rate_limit_buckets'",
  );
  if (limiterTable.rows.length !== 1) {
    throw new Error("Rate-limit table was not created during migration");
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
