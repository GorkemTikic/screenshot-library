const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function base64urlEncode(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64urlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToBytes(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function createAccessCode(contributorId: string, secret = randomBytes(32)): string {
  return `fdsl_${contributorId}_${base64urlEncode(secret)}`;
}

export function parseAccessCode(code: string): { contributorId: string; secret: string } | null {
  const match = /^fdsl_([a-zA-Z0-9-]{3,64})_([a-zA-Z0-9_-]{32,})$/.exec(code.trim());
  return match?.[1] && match[2] ? { contributorId: match[1], secret: match[2] } : null;
}

// Workers Web Crypto rejects PBKDF2 calls above 100,000 iterations. Access
// codes are high-entropy random values, so use the platform maximum here.
export async function hashAccessCode(code: string, salt: Uint8Array, iterations = 100_000): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return base64urlEncode(new Uint8Array(bits));
}

export function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let mismatch = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) mismatch |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  return mismatch === 0;
}

export async function verifyAccessCode(code: string, salt: Uint8Array, expectedHash: string, iterations = 100_000): Promise<boolean> {
  const actualHash = await hashAccessCode(code, salt, iterations);
  return timingSafeEqual(actualHash, expectedHash);
}

export type SessionRole = 'owner' | 'contributor';
export interface SessionPayload {
  sub: string;
  role: SessionRole;
  codeVersion: number;
  iat: number;
  exp: number;
  jti: string;
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return base64urlEncode(new Uint8Array(signature));
}

export async function createSessionToken(
  input: Pick<SessionPayload, 'sub' | 'role' | 'codeVersion'>,
  secret: string,
  now = Date.now(),
  ttlMs = 8 * 60 * 60 * 1000,
): Promise<string> {
  const payload: SessionPayload = {
    ...input,
    iat: now,
    exp: now + ttlMs,
    jti: crypto.randomUUID(),
  };
  const encoded = base64urlEncode(JSON.stringify(payload));
  return `${encoded}.${await hmac(encoded, secret)}`;
}

export async function verifySessionToken(token: string, secret: string, now = Date.now()): Promise<SessionPayload | null> {
  const [encoded, providedSignature, extra] = token.split('.');
  if (!encoded || !providedSignature || extra) return null;
  const expectedSignature = await hmac(encoded, secret);
  if (!timingSafeEqual(expectedSignature, providedSignature)) return null;
  try {
    const payload = JSON.parse(decoder.decode(base64urlDecode(encoded))) as SessionPayload;
    if (!payload.sub || !payload.jti || !['owner', 'contributor'].includes(payload.role) || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return base64urlEncode(new Uint8Array(digest));
}
