import { describe, expect, it } from 'vitest';
import { allowedOrigin, bearerToken, json } from '../src/http';

describe('privileged HTTP boundary', () => {
  it('allows exact configured origins and never wildcard', () => {
    const configured = 'http://localhost:5173,https://gorkemtikic.github.io';
    expect(allowedOrigin('http://localhost:5173', configured)).toBe('http://localhost:5173');
    expect(allowedOrigin('https://attacker.example', configured)).toBeNull();
    expect(allowedOrigin('https://attacker.example', '*')).toBeNull();
  });

  it('extracts only a valid bearer header', () => {
    expect(bearerToken(new Request('https://example.com', { headers: { Authorization: 'Bearer abc.def' } }))).toBe('abc.def');
    expect(bearerToken(new Request('https://example.com', { headers: { Authorization: 'Basic abc' } }))).toBeNull();
  });

  it('returns JSON with request id and safe origin', async () => {
    const response = json({ ok: true }, 201, 'req-1', 'http://localhost:5173');
    expect(response.status).toBe(201);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('x-request-id')).toBe('req-1');
    await expect(response.json()).resolves.toEqual({ ok: true, requestId: 'req-1' });
  });
});
