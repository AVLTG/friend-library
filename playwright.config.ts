import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";
const databasePath = resolve(process.cwd(), ".test/e2e.db");
const databaseUrl = pathToFileURL(databasePath).href;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run test:e2e:server",
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      APP_ORIGIN: baseURL,
      TURSO_DATABASE_URL: databaseUrl,
      TURSO_AUTH_TOKEN: "",
      JWT_SECRET: "playwright-only-secret-at-least-32-characters",
    },
  },
});
