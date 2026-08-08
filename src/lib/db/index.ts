import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client/node";
import * as schema from "./schema";
import { getTursoConfig } from "../env";

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    const { url, authToken } = getTursoConfig();
    client = createClient({
      url,
      authToken,
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
