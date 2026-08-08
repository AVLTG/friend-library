export interface TursoConfig {
  url: string;
  authToken?: string;
}

function parseOrigin(value: string, variableName: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid absolute URL`);
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${variableName} must contain only an HTTP(S) origin`);
  }

  return url.origin;
}

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  const normalized = secret?.trim();
  if (
    !normalized ||
    new TextEncoder().encode(normalized).length < 32 ||
    normalized === "your-secret-key-min-32-chars-long-here" ||
    new Set(normalized).size < 8
  ) {
    throw new Error("JWT_SECRET must be set to at least 32 bytes");
  }
  return new TextEncoder().encode(normalized);
}

export function getTursoConfig(): TursoConfig {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

  if (!url) {
    throw new Error("TURSO_DATABASE_URL is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("TURSO_DATABASE_URL must be a valid URL");
  }

  if (!["libsql:", "https:", "file:"].includes(parsed.protocol)) {
    throw new Error("TURSO_DATABASE_URL must use libsql, https, or file protocol");
  }
  if (parsed.protocol === "file:" && process.env.NODE_ENV === "production") {
    throw new Error("File databases are not supported in production");
  }
  if (parsed.protocol !== "file:" && !authToken) {
    throw new Error("TURSO_AUTH_TOKEN is required for remote databases");
  }

  return { url, authToken };
}

export function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const configuredOrigin = process.env.APP_ORIGIN;

  if (configuredOrigin) {
    origins.add(parseOrigin(configuredOrigin, "APP_ORIGIN"));
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("APP_ORIGIN is required in production");
  } else {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    origins.add(parseOrigin(`https://${process.env.VERCEL_URL}`, "VERCEL_URL"));
  }
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_BRANCH_URL) {
    origins.add(
      parseOrigin(
        `https://${process.env.VERCEL_BRANCH_URL}`,
        "VERCEL_BRANCH_URL",
      ),
    );
  }

  return origins;
}

export function getGoogleBooksApiKey(): string | undefined {
  return process.env.GOOGLE_BOOKS_API_KEY || undefined;
}
