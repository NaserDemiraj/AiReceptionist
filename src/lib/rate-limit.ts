/**
 * Distributed rate limiter with Redis (Upstash) backend.
 *
 * Production: Uses Upstash Redis API (serverless, no ops overhead).
 * Dev/fallback: Uses in-memory sliding-window algorithm.
 *
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for distributed mode.
 * Without them, falls back to in-memory (fine for single Vercel instance during dev).
 */

import { Redis } from "@upstash/redis";
import { logger } from "./logger";
import { captureError } from "./sentry";

// Upstash client (only initialized if env vars present)
let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch (err) {
    logger.error({ err }, "Failed to initialize Upstash Redis");
    captureError(err instanceof Error ? err : new Error(String(err)), {
      context: "upstash_init",
    });
  }
}

// In-memory fallback (for dev / single-instance)
interface Bucket {
  timestamps: number[];
}
const buckets = new Map<string, Bucket>();
const SWEEP_INTERVAL_MS = 5 * 60_000;
let lastSweep = Date.now();

function rateLimitMemory(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now();

  // Sweep old buckets periodically
  if (now - lastSweep > SWEEP_INTERVAL_MS) {
    lastSweep = now;
    for (const [k, b] of buckets) {
      if (b.timestamps.length === 0 || now - b.timestamps[b.timestamps.length - 1] > windowMs) {
        buckets.delete(k);
      }
    }
  }

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= limit) {
    return { allowed: false, remaining: 0 };
  }
  bucket.timestamps.push(now);
  return { allowed: true, remaining: limit - bucket.timestamps.length };
}

async function rateLimitRedis(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    if (!redis) return rateLimitMemory(key, limit, windowMs);

    // Use Redis INCR with EXPIRE for atomic rate limiting
    const count = await redis.incr(key);
    if (count === 1) {
      // First request in this window: set expiry
      await redis.expire(key, Math.ceil(windowMs / 1000));
    }

    if (count > limit) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: limit - count };
  } catch (err) {
    // If Redis fails, fall back to in-memory (fail-open)
    logger.warn({ err, key }, "Redis rate limit failed, using in-memory");
    captureError(err instanceof Error ? err : new Error(String(err)), {
      context: "redis_rate_limit",
      key,
    });
    return rateLimitMemory(key, limit, windowMs);
  }
}

/**
 * Check rate limit for a given key.
 * Uses Upstash Redis if configured, otherwise in-memory.
 *
 * Usage: const { allowed } = rateLimit("chat:widgetkey:visitor", 20, 60_000)
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number }> {
  if (redis) {
    return rateLimitRedis(key, limit, windowMs);
  }
  return rateLimitMemory(key, limit, windowMs);
}
