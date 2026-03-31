import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const instance = drizzle(getClient(), { schema });
    return (instance as unknown as Record<string | symbol, unknown>)[prop];
  },
});
