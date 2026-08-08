import { createClient } from "@libsql/client/node";
import { config } from "dotenv";
import { adoptBaseline } from "./lib/adopt-baseline.mjs";

config({ path: ".env.local", override: false });

if (process.env.CONFIRM_BASELINE_ADOPTION !== "adopt-0000-baseline") {
  throw new Error(
    "Set CONFIRM_BASELINE_ADOPTION=adopt-0000-baseline after verifying this is a Turso clone",
  );
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken || url.startsWith("file:")) {
  throw new Error("A remote Turso URL and auth token are required");
}

const client = createClient({ url, authToken });
try {
  const result = await adoptBaseline(client, process.cwd());
  console.log(`Baseline status: ${result}`);
} finally {
  client.close();
}
