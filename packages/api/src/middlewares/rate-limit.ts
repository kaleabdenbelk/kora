import { TRPCError } from "@trpc/server";
import Redis from "ioredis";
import { env } from "@kora/env/server";

// Initialize Redis client using the existing environment variables
const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
});

/**
 * Creates a generic tRPC rate limit middleware.
 * Uses a simple fixed window counter in Redis.
 *
 * @param windowMs The time window in milliseconds (e.g., 60000 for 1 minute)
 * @param maxRequests The maximum number of requests allowed per user within the window
 * @param prefix An optional prefix for the Redis key to separate different limits
 */
export function createRateLimiter(windowMs: number, maxRequests: number, prefix: string) {
  return async ({ ctx, next, path }: any) => {
    // If there is no user session, skip rate limiting or apply IP based fallback
    // Since this is meant for protected procedures, user ID should be present.
    const userId = ctx.session?.user?.id || "anonymous";
    const key = `ratelimit:${prefix}:${userId}:${path}`;

    try {
      // Increment the counter and set expiration if it's a new key
      const currentCount = await redis.incr(key);

      if (currentCount === 1) {
        // Set expiry on the first request of the window in seconds
        // Using pexpire for millisecond precision
        await redis.pexpire(key, windowMs);
      }

      if (currentCount > maxRequests) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Rate limit exceeded. Try again later.`,
        });
      }

      return next({ ctx });
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      // If Redis fails, fail open (allow the request) to prevent API outage
      console.error("[RateLimiter] Redis error:", error);
      return next({ ctx });
    }
  };
}
