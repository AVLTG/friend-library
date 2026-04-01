// Simple in-memory rate limiter for serverless functions.
// Tracks request counts per IP within sliding windows.
// Resets on cold starts, but effective against burst attacks.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  return stores.get(name)!;
}

interface RateLimitConfig {
  name: string; // Unique name for this limiter
  maxRequests: number; // Max requests in the window
  windowMs: number; // Window duration in milliseconds
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // ms until reset
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const store = getStore(config.name);
  const now = Date.now();

  // Clean expired entries periodically (every 100 checks)
  if (Math.random() < 0.01) {
    for (const [k, v] of store) {
      if (v.resetAt < now) store.delete(k);
    }
  }

  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetAt - now,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetAt - now,
  };
}

// Extract IP from request, falling back gracefully
export function getClientIp(request: Request): string {
  const headers = new Headers(request.headers);
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

// Pre-configured limiters
export const AUTH_LIMIT = {
  name: "auth",
  maxRequests: 10,
  windowMs: 15 * 60 * 1000, // 10 attempts per 15 minutes
};

export const SEARCH_LIMIT = {
  name: "search",
  maxRequests: 30,
  windowMs: 60 * 1000, // 30 searches per minute
};

export const INVITE_LIMIT = {
  name: "invite",
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 5 invites per hour
};

export const GENERAL_API_LIMIT = {
  name: "general",
  maxRequests: 100,
  windowMs: 60 * 1000, // 100 requests per minute
};
