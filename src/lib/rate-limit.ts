import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { lt, sql } from "drizzle-orm";
import { db } from "./db";
import { rateLimitBuckets } from "./db/schema";

interface RateLimitConfig {
  name: string;
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

let checksSinceCleanup = 0;

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const resetAt = now + config.windowMs;
  const keyHash = createHash("sha256").update(key).digest("hex");
  const id = `${config.name}:${keyHash}`;

  const bucket = await db
    .insert(rateLimitBuckets)
    .values({ id, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimitBuckets.id,
      set: {
        count: sql`CASE WHEN ${rateLimitBuckets.resetAt} <= ${now} THEN 1 ELSE MIN(${rateLimitBuckets.count} + 1, ${config.maxRequests + 1}) END`,
        resetAt: sql`CASE WHEN ${rateLimitBuckets.resetAt} <= ${now} THEN ${resetAt} ELSE ${rateLimitBuckets.resetAt} END`,
      },
    })
    .returning({
      count: rateLimitBuckets.count,
      resetAt: rateLimitBuckets.resetAt,
    })
    .get();

  const allowed = bucket.count <= config.maxRequests;

  checksSinceCleanup += 1;
  if (checksSinceCleanup >= 100) {
    checksSinceCleanup = 0;
    try {
      await db
        .delete(rateLimitBuckets)
        .where(lt(rateLimitBuckets.resetAt, now - 24 * 60 * 60 * 1000));
    } catch (error) {
      console.error("Rate-limit cleanup error:", error);
    }
  }

  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - bucket.count),
    resetIn: Math.max(0, bucket.resetAt - now),
  };
}

export function getClientIp(request: Request): string {
  if (process.env.VERCEL !== "1") return "unknown";

  const forwarded = request.headers
    .get("x-vercel-forwarded-for")
    ?.split(",", 1)[0]
    ?.trim();

  return forwarded && isIP(forwarded) ? forwarded : "unknown";
}

export const AUTH_LIMIT = {
  name: "auth",
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
};

export const PASSWORD_LIMIT = {
  name: "password",
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
};

export const SEARCH_LIMIT = {
  name: "search",
  maxRequests: 30,
  windowMs: 60 * 1000,
};

export const INVITE_LIMIT = {
  name: "invite",
  maxRequests: 5,
  windowMs: 60 * 60 * 1000,
};
