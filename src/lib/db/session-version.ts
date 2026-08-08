import { createClient, type Client } from "@libsql/client/web";
import { getTursoConfig } from "../env";

let client: Client | null = null;

export interface SessionVersionLookup {
  checked: boolean;
  sessionVersion: number | null;
}

export async function lookupSessionVersion(
  userId: string,
): Promise<SessionVersionLookup> {
  const config = getTursoConfig();

  // Edge middleware cannot open file databases. Route handlers still perform
  // the version check for local development and end-to-end tests.
  if (config.url.startsWith("file:")) {
    return { checked: false, sessionVersion: null };
  }

  if (!client) {
    client = createClient(config);
  }

  const result = await client.execute({
    sql: "SELECT session_version FROM users WHERE id = ? LIMIT 1",
    args: [userId],
  });
  const value = result.rows[0]?.session_version;

  return {
    checked: true,
    sessionVersion: typeof value === "number" ? value : null,
  };
}
