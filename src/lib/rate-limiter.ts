import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Unified rate limit result interface
export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

// Create Redis instance (for production)
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken ? new Redis({
  url: redisUrl,
  token: redisToken,
}) : null;

// Local fallback for development (when Redis not available)
const MAX_MAP_SIZE = 10000;

export class LocalRateLimiter {
  private attempts = new Map<string, { count: number; reset: number }>();

  async limit(identifier: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): Promise<RateLimitResult> {
    const now = Date.now();

    // Periodic cleanup: remove stale entries when map grows too large
    if (this.attempts.size > MAX_MAP_SIZE) {
      for (const [key, record] of this.attempts) {
        if (record.reset < now) {
          this.attempts.delete(key);
        }
      }
    }

    const record = this.attempts.get(identifier);

    if (!record || record.reset < now) {
      this.attempts.set(identifier, { count: 1, reset: now + windowMs });
      return { success: true, remaining: maxAttempts - 1, reset: now + windowMs };
    }

    if (record.count >= maxAttempts) {
      return {
        success: false,
        remaining: 0,
        reset: record.reset,
      };
    }

    record.count++;
    return { success: true, remaining: maxAttempts - record.count, reset: record.reset };
  }
}

// Wrapper that provides a unified interface regardless of backend
class UnifiedRateLimiter {
  constructor(private primaryLimiter: Ratelimit, private fallbackLimiter: LocalRateLimiter) {}

  async limit(identifier: string): Promise<RateLimitResult> {
    try {
      const result = await this.primaryLimiter.limit(identifier);
      return { success: result.success, remaining: result.remaining, reset: result.reset };
    } catch (error) {
      console.warn('Primary rate limiter failed, using fallback:', error);
      return await this.fallbackLimiter.limit(identifier);
    }
  }
}

// Shared interface type for all exported limiters
export type RateLimiter = LocalRateLimiter | UnifiedRateLimiter;

// Different limiters for different endpoints
export const loginLimiter: RateLimiter = redis ? new UnifiedRateLimiter(new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 attempts per 15 minutes
  analytics: true,
}), new LocalRateLimiter()) : new LocalRateLimiter();

export const apiLimiter: RateLimiter = redis ? new UnifiedRateLimiter(new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
}), new LocalRateLimiter()) : new LocalRateLimiter();

export const uploadLimiter: RateLimiter = redis ? new UnifiedRateLimiter(new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 uploads per hour
  analytics: true,
}), new LocalRateLimiter()) : new LocalRateLimiter();

// Convenience aliases
export const localLoginLimiter = loginLimiter;
export const localApiLimiter = apiLimiter;