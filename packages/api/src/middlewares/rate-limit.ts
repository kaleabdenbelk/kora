import { env } from "@kora/env/server";
import { TRPCError } from "@trpc/server";
import Redis from "ioredis";

type RateLimitClient = {
  incr: (key: string) => Promise<number>;
  pexpire: (key: string, ms: number) => Promise<number>;
};

// Initialize Redis client using the existing environment variables
let redisClient: RateLimitClient = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      tls:
        env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined,
    })
  : new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      tls:
        env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined,
    });

// Test helper for injecting a mock/fake Redis client.
export function setRateLimiterClientForTests(client: RateLimitClient) {
  redisClient = client;
}

/**
 * Creates a generic tRPC rate limit middleware.
 * Uses a simple fixed window counter in Redis.
 *
 * @param windowMs The time window in milliseconds (e.g., 60000 for 1 minute)
 * @param maxRequests The maximum number of requests allowed per user within the window
 * @param prefix An optional prefix for the Redis key to separate different limits
 */
export function createRateLimiter(
  windowMs: number,
  maxRequests: number,
  prefix: string,
  failOpen = true,
) {
  return async ({ ctx, next, path }: { ctx: any; next: any; path: string }) => {
    // If there is no user session, skip rate limiting or apply IP based fallback
    // Since this is meant for protected procedures, user ID should be present.
    const userId = ctx.session?.user?.id || "anonymous";
    const key = `ratelimit:${prefix}:${userId}:${path}`;

    try {
      // Increment the counter and set expiration if it's a new key
      const currentCount = await redisClient.incr(key);

      if (currentCount === 1) {
        // Set expiry on the first request of the window in seconds
        // Using pexpire for millisecond precision
        await redisClient.pexpire(key, windowMs);
      }

      if (currentCount > maxRequests) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded. Try again later.",
        });
      }

      return next({ ctx });
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      console.error("[RateLimiter] Redis error:", error);

      if (!failOpen) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Service unavailable (Rate limiter is down)",
        });
      }

      return next({ ctx });
    }
  };
}
