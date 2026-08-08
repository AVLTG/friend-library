import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const databasePath = fileURLToPath(new URL("../.test/e2e.db", import.meta.url));
const databaseUrl = pathToFileURL(databasePath).href;
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

if (process.env.TURSO_DATABASE_URL !== databaseUrl) {
  throw new Error(
    `Refusing to reset unexpected database: ${process.env.TURSO_DATABASE_URL ?? "<unset>"}`,
  );
}

await mkdir(dirname(databasePath), { recursive: true });
await Promise.all([
  rm(databasePath, { force: true }),
  rm(`${databasePath}-shm`, { force: true }),
  rm(`${databasePath}-wal`, { force: true }),
]);

const client = createClient({ url: databaseUrl });

try {
  await migrate(drizzle(client), { migrationsFolder });
} finally {
  client.close();
}
