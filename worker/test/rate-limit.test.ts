import { describe, expect, it } from 'vitest';
import { consumeRateLimit, fixedWindowStart, rateLimitKey } from '../src/rate-limit';
import type { Env } from '../src/types';

describe('production rate limits', () => {
  it('uses deterministic fixed windows and hashed subjects', async () => {
    expect(fixedWindowStart(Date.parse('2026-09-12T12:14:59Z'), 15 * 60_000)).toBe('2026-09-12T12:00:00.000Z');
    expect(fixedWindowStart(Date.parse('2026-09-12T12:15:00Z'), 15 * 60_000)).toBe('2026-09-12T12:15:00.000Z');
    await expect(rateLimitKey('login', '203.0.113.8')).resolves.toMatch(/^login:[A-Za-z0-9_-]{40,}$/);
    await expect(rateLimitKey('login', '203.0.113.8')).resolves.not.toContain('203.0.113.8');
  });

  it('rejects requests after the configured bucket limit', async () => {
    let count = 0;
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ request_count: ++count }),
          }),
        }),
      },
    } as unknown as Pick<Env, 'DB'>;
    const policy = { limit: 2, windowMs: 60_000, code: 'TEST_LIMITED', message: 'Slow down.' };
    await expect(consumeRateLimit(env, 'test:key', policy, 0)).resolves.toBeUndefined();
    await expect(consumeRateLimit(env, 'test:key', policy, 0)).resolves.toBeUndefined();
    await expect(consumeRateLimit(env, 'test:key', policy, 0)).rejects.toMatchObject({ status: 429, code: 'TEST_LIMITED' });
  });
});
