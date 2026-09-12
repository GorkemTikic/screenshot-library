import { base64urlDecode, base64urlEncode, createSessionToken, hashAccessCode, parseAccessCode, randomBytes, sha256, timingSafeEqual, verifyAccessCode, verifySessionToken } from './crypto';
import { ApiError, bearerToken } from './http';
import type { ContributorRow, Env, Principal } from './types';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

async function contributorById(env: Env, id: string): Promise<ContributorRow | null> {
  return env.DB.prepare('SELECT * FROM contributors WHERE id = ?').bind(id).first<ContributorRow>();
}

async function ensureBootstrapOwner(env: Env, code: string): Promise<ContributorRow | null> {
  if (!env.OWNER_BOOTSTRAP_CODE || !timingSafeEqual(code, env.OWNER_BOOTSTRAP_CODE)) return null;
  const now = new Date().toISOString();
  const salt = randomBytes(16);
  const hash = await hashAccessCode(code, salt);
  await env.DB.prepare(`
    INSERT INTO contributors (id, owner_key, display_name, role, code_hash, code_salt, status, code_version, created_at, updated_at)
    VALUES ('owner-bootstrap', 'cs-gorkem-t', 'CS Gorkem T', 'owner', ?, ?, 'active', 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, role = 'owner', status = 'active', updated_at = excluded.updated_at
  `).bind(hash, base64urlEncode(salt), now, now).run();
  return contributorById(env, 'owner-bootstrap');
}

async function validContributorForCode(env: Env, code: string): Promise<ContributorRow | null> {
  const parsed = parseAccessCode(code);
  if (!parsed) return ensureBootstrapOwner(env, code);
  const contributor = await contributorById(env, parsed.contributorId);
  if (!contributor || contributor.status !== 'active') return null;
  const salt = base64urlDecode(contributor.code_salt);
  return await verifyAccessCode(code, salt, contributor.code_hash) ? contributor : null;
}

export async function login(env: Env, code: string): Promise<{ token: string; principal: Principal; expiresAt: string }> {
  const contributor = await validContributorForCode(env, code.trim());
  if (!contributor) throw new ApiError(401, 'Access code is invalid or disabled.', 'INVALID_ACCESS_CODE');
  const now = Date.now();
  const token = await createSessionToken({ sub: contributor.id, role: contributor.role, codeVersion: contributor.code_version }, env.SESSION_SECRET, now, SESSION_TTL_MS);
  const tokenHash = await sha256(token);
  const payload = await verifySessionToken(token, env.SESSION_SECRET, now);
  if (!payload) throw new ApiError(500, 'Session could not be created.', 'SESSION_CREATE_FAILED');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (id, contributor_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(payload.jti, contributor.id, tokenHash, new Date(payload.exp).toISOString(), new Date(now).toISOString()),
    env.DB.prepare('UPDATE contributors SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .bind(new Date(now).toISOString(), new Date(now).toISOString(), contributor.id),
  ]);
  return {
    token,
    principal: { id: contributor.id, ownerKey: contributor.owner_key, displayName: contributor.display_name, role: contributor.role, sessionId: payload.jti, codeVersion: contributor.code_version },
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export async function authenticate(request: Request, env: Env): Promise<Principal> {
  const token = bearerToken(request);
  if (!token) throw new ApiError(401, 'Sign in to continue.', 'AUTH_REQUIRED');
  const payload = await verifySessionToken(token, env.SESSION_SECRET);
  if (!payload) throw new ApiError(401, 'Your session expired. Sign in again.', 'SESSION_EXPIRED');
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`
    SELECT c.*, s.id AS session_id, s.revoked_at, s.expires_at
    FROM sessions s JOIN contributors c ON c.id = s.contributor_id
    WHERE s.id = ? AND s.token_hash = ?
  `).bind(payload.jti, tokenHash).first<ContributorRow & { session_id: string; revoked_at: string | null; expires_at: string }>();
  if (!row || row.revoked_at || row.status !== 'active' || row.code_version !== payload.codeVersion || Date.parse(row.expires_at) <= Date.now()) {
    throw new ApiError(401, 'Your session is no longer active.', 'SESSION_REVOKED');
  }
  return { id: row.id, ownerKey: row.owner_key, displayName: row.display_name, role: row.role, sessionId: row.session_id, codeVersion: row.code_version };
}

export async function logout(request: Request, env: Env): Promise<void> {
  const principal = await authenticate(request, env);
  await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').bind(new Date().toISOString(), principal.sessionId).run();
}

export function requireOwner(principal: Principal): void {
  if (principal.role !== 'owner') throw new ApiError(403, 'Owner access is required.', 'OWNER_REQUIRED');
}
