import { NextFunction, Request, Response } from 'express';
import { Ratelimit, type Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '../config/env';
import { getRedisClient } from '../lib/redis';

type RateLimitConfig = {
  keyPrefix: string;
  windowMs: number;
  max: number;
  message: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
};

const buckets = new Map<string, Bucket>();
const upstashLimiters = new Map<string, Ratelimit>();
let upstashRedisClient: Redis | null = null;
let lastCleanupAt = 0;
let redisFallbackWarned = false;
let upstashFailureWarned = false;

function cleanupBuckets(now: number): void {
  if (now - lastCleanupAt < 60_000) return;

  lastCleanupAt = now;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function resolveKey(req: Request, config: RateLimitConfig): string {
  return `${config.keyPrefix}:${req.ip ?? req.socket.remoteAddress ?? 'unknown'}`;
}

function applyHeaders(res: Response, decision: RateLimitDecision): void {
  res.setHeader('RateLimit-Limit', String(decision.limit));
  res.setHeader('RateLimit-Remaining', String(decision.remaining));
  res.setHeader('RateLimit-Reset', String(Math.ceil(decision.resetAt / 1000)));
}

function getWindowLabel(windowMs: number): Duration {
  return `${Math.max(Math.ceil(windowMs / 1000), 1)} s` as Duration;
}

function getUpstashRedisClient(): Redis {
  if (upstashRedisClient) {
    return upstashRedisClient;
  }

  const { upstashRedisRestUrl, upstashRedisRestToken } = env;

  if (!upstashRedisRestUrl || !upstashRedisRestToken) {
    throw new Error('Missing required Upstash Redis environment variables');
  }

  upstashRedisClient = new Redis({
    url: upstashRedisRestUrl,
    token: upstashRedisRestToken,
  });

  return upstashRedisClient;
}

function getUpstashLimiter(config: RateLimitConfig): Ratelimit {
  const cacheKey = `${config.keyPrefix}:${config.windowMs}:${config.max}`;
  const existingLimiter = upstashLimiters.get(cacheKey);

  if (existingLimiter) {
    return existingLimiter;
  }

  const limiter = new Ratelimit({
    redis: getUpstashRedisClient(),
    limiter: Ratelimit.fixedWindow(config.max, getWindowLabel(config.windowMs)),
    prefix: config.keyPrefix,
    timeout: 1_000,
    ephemeralCache: false,
  });

  upstashLimiters.set(cacheKey, limiter);
  return limiter;
}

async function applyUpstashRateLimit(
  config: RateLimitConfig,
  key: string,
): Promise<RateLimitDecision> {
  const result = await getUpstashLimiter(config).limit(key);
  const resetAt = result.reset;

  if (!result.success) {
    const retryAfterSeconds = Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1);

    return {
      allowed: false,
      limit: result.limit,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    limit: result.limit,
    remaining: result.remaining,
    resetAt,
  };
}

function applyMemoryRateLimit(config: RateLimitConfig, key: string): RateLimitDecision {
  const now = Date.now();
  cleanupBuckets(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const nextBucket = { count: 1, resetAt: now + config.windowMs };
    buckets.set(key, nextBucket);

    return {
      allowed: true,
      limit: config.max,
      remaining: config.max - 1,
      resetAt: nextBucket.resetAt,
    };
  }

  if (bucket.count >= config.max) {
    const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);
    return {
      allowed: false,
      limit: config.max,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSeconds,
    };
  }

  bucket.count += 1;

  return {
    allowed: true,
    limit: config.max,
    remaining: Math.max(config.max - bucket.count, 0),
    resetAt: bucket.resetAt,
  };
}

function sendRateLimitResponse(
  res: Response,
  config: RateLimitConfig,
  decision: RateLimitDecision,
): boolean {
  applyHeaders(res, decision);

  if (decision.allowed) {
    return false;
  }

  const retryAfterSeconds = decision.retryAfterSeconds ?? 1;

  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({
    error: config.message,
    retryAfterSeconds,
  });

  return true;
}

async function applyRedisRateLimit(
  config: RateLimitConfig,
  key: string,
): Promise<RateLimitDecision> {
  const client = await getRedisClient();

  const result = (await client.eval(
    `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`,
    {
      keys: [key],
      arguments: [String(config.windowMs)],
    },
  )) as [number | string, number | string];

  const count = Number(result[0]);
  const ttlMs = Math.max(Number(result[1]), 0);
  const resetAt = Date.now() + ttlMs;

  if (count > config.max) {
    const retryAfterSeconds = Math.max(Math.ceil(ttlMs / 1000), 1);

    return {
      allowed: false,
      limit: config.max,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    limit: config.max,
    remaining: Math.max(config.max - count, 0),
    resetAt,
  };
}

export function createRateLimiter(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = resolveKey(req, config);

    try {
      const decision =
        env.nodeEnv === 'production'
          ? await applyUpstashRateLimit(config, key)
          : await applyRedisRateLimit(config, key);

      if (sendRateLimitResponse(res, config, decision)) {
        return;
      }

      next();
      return;
    } catch (error) {
      if (env.nodeEnv === 'production') {
        if (!upstashFailureWarned) {
          upstashFailureWarned = true;
          process.emitWarning(
            `Upstash rate limiter unavailable: ${
              error instanceof Error ? error.message : String(error)
            }`,
            {
              code: 'UPSTASH_RATE_LIMIT_UNAVAILABLE',
            },
          );
        }

        res.status(503).json({
          error: 'Rate limit service unavailable. Please try again later.',
        });
        return;
      }

      if (!redisFallbackWarned) {
        redisFallbackWarned = true;
        process.emitWarning(
          `Redis rate limiter unavailable, falling back to in-memory counters: ${
            error instanceof Error ? error.message : String(error)
          }`,
          {
            code: 'REDIS_RATE_LIMIT_FALLBACK',
          },
        );
      }

      const decision = applyMemoryRateLimit(config, key);
      if (sendRateLimitResponse(res, config, decision)) {
        return;
      }

      next();
    }
  };
}

export function resetRateLimitState(): void {
  buckets.clear();
  upstashLimiters.clear();
  lastCleanupAt = 0;
  redisFallbackWarned = false;
  upstashFailureWarned = false;
  upstashRedisClient = null;
}

export const googleLoginLimiter = createRateLimiter({
  keyPrefix: 'auth-google-login',
  windowMs: env.rateLimitWindowMs,
  max: 5,
  message: 'Too many Google login attempts. Please try again later.',
});

export const googleCallbackLimiter = createRateLimiter({
  keyPrefix: 'auth-google-callback',
  windowMs: env.rateLimitWindowMs,
  max: 10,
  message: 'Too many Google callback attempts. Please try again later.',
});

export const refreshLimiter = createRateLimiter({
  keyPrefix: 'auth-refresh',
  windowMs: env.rateLimitWindowMs,
  max: 30,
  message: 'Too many refresh requests. Please try again later.',
});

export const logoutLimiter = createRateLimiter({
  keyPrefix: 'auth-logout',
  windowMs: env.rateLimitWindowMs,
  max: 30,
  message: 'Too many logout requests. Please try again later.',
});

export const chatCreateLimiter = createRateLimiter({
  keyPrefix: 'chat-create',
  windowMs: env.rateLimitWindowMs,
  max: 20,
  message: 'Too many chat session requests. Please try again later.',
});

export const chatReadLimiter = createRateLimiter({
  keyPrefix: 'chat-read',
  windowMs: env.rateLimitWindowMs,
  max: 120,
  message: 'Too many chat read requests. Please try again later.',
});

export const chatMessageLimiter = createRateLimiter({
  keyPrefix: 'chat-message',
  windowMs: env.rateLimitWindowMs,
  max: 30,
  message: 'Too many chat message requests. Please try again later.',
});
