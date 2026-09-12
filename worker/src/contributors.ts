import { base64urlEncode, createAccessCode, hashAccessCode, randomBytes } from './crypto';
import { ApiError } from './http';
import type { ContributorRow, Env, Principal } from './types';

type ContributorInput = { displayName?: unknown; role?: unknown };

export function contributorIdFromName(displayName: string, suffix = crypto.randomUUID().slice(0, 6)): string {
  const slug = displayName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'contributor';
  return `${slug}-${suffix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`;
}

export function ownerKeyForContributor(id: string): string {
  return id === 'owner-bootstrap' ? 'cs-gorkem-t' : `contributor-${id}`;
}

export function validateContributorInput(input: ContributorInput): { displayName: string; role: 'owner' | 'contributor' } {
  const displayName = String(input.displayName || '').trim().replace(/\s+/g, ' ');
  const role = input.role || 'contributor';
  if (displayName.length < 2 || displayName.length > 80) throw new ApiError(400, 'Contributor name must be between 2 and 80 characters.', 'INVALID_CONTRIBUTOR_NAME');
  if (role !== 'owner' && role !== 'contributor') throw new ApiError(400, 'Contributor role is invalid.', 'INVALID_CONTRIBUTOR_ROLE');
  return { displayName, role };
}

function publicContributor(row: ContributorRow) {
  return {
    id: row.id,
    ownerKey: row.owner_key,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    codeVersion: row.code_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function listContributors(env: Env) {
  const result = await env.DB.prepare('SELECT * FROM contributors ORDER BY status ASC, display_name ASC').all<ContributorRow>();
  return { contributors: result.results.map(publicContributor) };
}

export async function listRequestAssignees(env: Env) {
  const result = await env.DB.prepare("SELECT id, display_name, role FROM contributors WHERE status = 'active' ORDER BY display_name ASC")
    .all<{ id: string; display_name: string; role: string }>();
  return { contributors: result.results.map((row) => ({ id: row.id, displayName: row.display_name, role: row.role })) };
}

export async function createContributor(env: Env, input: ContributorInput) {
  const { displayName, role } = validateContributorInput(input);
  const id = contributorIdFromName(displayName);
  const ownerKey = ownerKeyForContributor(id);
  const accessCode = createAccessCode(id);
  const salt = randomBytes(16);
  const codeHash = await hashAccessCode(accessCode, salt);
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(`INSERT INTO contributors
      (id, owner_key, display_name, role, code_hash, code_salt, status, code_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)`)
      .bind(id, ownerKey, displayName, role, codeHash, base64urlEncode(salt), now, now).run();
  } catch {
    throw new ApiError(409, 'A contributor with this name already exists.', 'CONTRIBUTOR_EXISTS');
  }
  const row = await env.DB.prepare('SELECT * FROM contributors WHERE id = ?').bind(id).first<ContributorRow>();
  if (!row) throw new ApiError(500, 'Contributor could not be created.', 'CONTRIBUTOR_CREATE_FAILED');
  return { contributor: publicContributor(row), accessCode };
}

export async function updateContributor(env: Env, principal: Principal, id: string, input: Record<string, unknown>) {
  const current = await env.DB.prepare('SELECT * FROM contributors WHERE id = ?').bind(id).first<ContributorRow>();
  if (!current) throw new ApiError(404, 'Contributor not found.', 'CONTRIBUTOR_NOT_FOUND');
  const displayName = input.displayName === undefined ? current.display_name : String(input.displayName).trim().replace(/\s+/g, ' ');
  const role = input.role === undefined ? current.role : input.role;
  const status = input.status === undefined ? current.status : input.status;
  validateContributorInput({ displayName, role });
  if (status !== 'active' && status !== 'disabled') throw new ApiError(400, 'Contributor status is invalid.', 'INVALID_CONTRIBUTOR_STATUS');
  if (principal.id === id && (status === 'disabled' || role !== 'owner')) throw new ApiError(400, 'You cannot disable or demote your own owner account.', 'SELF_LOCKOUT');
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('UPDATE contributors SET display_name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?').bind(displayName, role, status, now, id),
    ...(status === 'disabled' ? [env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE contributor_id = ? AND revoked_at IS NULL').bind(now, id)] : []),
  ]);
  const row = await env.DB.prepare('SELECT * FROM contributors WHERE id = ?').bind(id).first<ContributorRow>();
  return { contributor: publicContributor(row!) };
}

export async function rotateContributorCode(env: Env, id: string) {
  const current = await env.DB.prepare('SELECT * FROM contributors WHERE id = ?').bind(id).first<ContributorRow>();
  if (!current) throw new ApiError(404, 'Contributor not found.', 'CONTRIBUTOR_NOT_FOUND');
  const accessCode = createAccessCode(id);
  const salt = randomBytes(16);
  const codeHash = await hashAccessCode(accessCode, salt);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('UPDATE contributors SET code_hash = ?, code_salt = ?, code_version = code_version + 1, updated_at = ? WHERE id = ?').bind(codeHash, base64urlEncode(salt), now, id),
    env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE contributor_id = ? AND revoked_at IS NULL').bind(now, id),
  ]);
  const row = await env.DB.prepare('SELECT * FROM contributors WHERE id = ?').bind(id).first<ContributorRow>();
  return { contributor: publicContributor(row!), accessCode };
}

export async function listAudit(env: Env, limit = 100) {
  const safeLimit = Math.max(1, Math.min(250, limit));
  const result = await env.DB.prepare(`SELECT a.*, c.display_name FROM audit_events a
    JOIN contributors c ON c.id = a.contributor_id ORDER BY a.created_at DESC LIMIT ?`).bind(safeLimit).all<Record<string, unknown>>();
  return { events: result.results.map((row) => ({
    id: row.id,
    contributorId: row.contributor_id,
    contributorName: row.display_name,
    action: row.action,
    recordId: row.record_id,
    commitSha: row.commit_sha,
    changedFields: JSON.parse(String(row.changed_fields_json || '[]')),
    createdAt: row.created_at,
    requestId: row.request_id,
  })) };
}
