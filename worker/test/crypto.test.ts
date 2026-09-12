import { describe, expect, it, vi } from 'vitest';
import {
  createAccessCode,
  createSessionToken,
  hashAccessCode,
  parseAccessCode,
  verifyAccessCode,
  verifySessionToken,
} from '../src/crypto';

describe('contributor access codes', () => {
  it('creates parseable codes without embedding the display name', () => {
    const code = createAccessCode('abc-123', new Uint8Array(32).fill(7));
    expect(code.startsWith('fdsl_abc-123_')).toBe(true);
    expect(parseAccessCode(code)?.contributorId).toBe('abc-123');
    expect(parseAccessCode('wrong')).toBeNull();
  });

  it('hashes and verifies a code using PBKDF2', async () => {
    const code = createAccessCode('person', new Uint8Array(32).fill(3));
    const salt = new Uint8Array(16).fill(9);
    const hash = await hashAccessCode(code, salt, 1000);
    await expect(verifyAccessCode(code, salt, hash, 1000)).resolves.toBe(true);
    await expect(verifyAccessCode(`${code}x`, salt, hash, 1000)).resolves.toBe(false);
  });

  it('keeps the default PBKDF2 work factor within the Workers Web Crypto limit', async () => {
    const deriveBits = vi.spyOn(crypto.subtle, 'deriveBits');
    await hashAccessCode('fdsl_test_default-work-factor', new Uint8Array(16).fill(4));
    expect(deriveBits).toHaveBeenCalledWith(
      expect.objectContaining({ iterations: 100_000 }),
      expect.anything(),
      256,
    );
    deriveBits.mockRestore();
  });
});

describe('session tokens', () => {
  it('signs, verifies and rejects tampered tokens', async () => {
    const secret = 'a-test-secret-that-is-long-enough';
    const token = await createSessionToken({ sub: 'person', role: 'contributor', codeVersion: 2 }, secret, 1000, 5000);
    const payload = await verifySessionToken(token, secret, 2000);
    expect(payload?.sub).toBe('person');
    expect(payload?.codeVersion).toBe(2);
    await expect(verifySessionToken(`${token}x`, secret, 2000)).resolves.toBeNull();
    await expect(verifySessionToken(token, secret, 7000)).resolves.toBeNull();
  });
});
