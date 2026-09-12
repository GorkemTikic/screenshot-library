import { sha256 } from './crypto';
import { ApiError } from './http';
import type { Env } from './types';

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
  code: string;
  message: string;
}

export const LOGIN_RATE_LIMIT: RateLimitPolicy = {
  limit: 10,
  windowMs: 15 * 60_000,
  code: 'LOGIN_RATE_LIMITED',
  message: 'Too many login attempts. Try again later.',
};

export const PUBLISH_RATE_LIMIT: RateLimitPolicy = {
  limit: 30,
  windowMs: 10 * 60_000,
  code: 'PUBLISH_RATE_LIMITED',
  message: 'Publishing limit reached. Try again shortly.',
};

export function fixedWindowStart(now: number, windowMs: number): string {
  return new Date(Math.floor(now / windowMs) * windowMs).toISOString();
}

export async function rateLimitKey(scope: string, subject: string): Promise<string> {
  return `${scope}:${await sha256(subject)}`;
}

export async function consumeRateLimit(
  env: Pick<Env, 'DB'>,
  key: string,
  policy: RateLimitPolicy,
  now = Date.now(),
): Promise<void> {
  const windowStartedAt = fixedWindowStart(now, policy.windowMs);
  const row = await env.DB.prepare(`
    INSERT INTO rate_limits (scope_key, window_started_at, request_count)
    VALUES (?, ?, 1)
    ON CONFLICT(scope_key) DO UPDATE SET
      request_count = CASE
        WHEN rate_limits.window_started_at = excluded.window_started_at
        THEN rate_limits.request_count + 1
        ELSE 1
      END,
      window_started_at = excluded.window_started_at
    RETURNING request_count
  `).bind(key, windowStartedAt).first<{ request_count: number }>();
  if (!row || Number(row.request_count) > policy.limit) {
    throw new ApiError(429, policy.message, policy.code);
  }
}
