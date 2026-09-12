import { advanceBranch, createCommit, readRepoHead, readRepoState, requestsTreeEntry } from './github';
import { json } from './http';
import {
  RequestConflictError,
  applyRequestTransition,
  normalizeRequestInput,
  normalizeSheetRow,
  requestRowToJson,
  requestSnapshot,
  sourceKeyForSheetRow,
  type RequestEventRow,
  type RequestRow,
} from './requests';
import type { Env, Principal } from './types';

const PUBLIC_RATE_LIMIT_MS = 60_000;

function principalFromRequest(request: Request): Principal | null {
  const value = request.headers.get('X-FDSL-Principal');
  return value ? JSON.parse(value) as Principal : null;
}

function historyJson(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    action: row.action,
    actorContributorId: row.actor_contributor_id || '',
    actorName: row.actor_name || 'Public requester',
    before: row.before_json ? JSON.parse(String(row.before_json)) : null,
    after: JSON.parse(String(row.after_json || '{}')),
    createdAt: row.created_at,
  };
}

export async function listWorkflowRequests(env: Env): Promise<Record<string, unknown>[]> {
  const requestResult = await env.DB.prepare(`
    SELECT r.*, assignee.display_name AS assignee_name, updater.display_name AS updated_by_name
    FROM workflow_requests r
    LEFT JOIN contributors assignee ON assignee.id = r.assignee_contributor_id
    LEFT JOIN contributors updater ON updater.id = r.updated_by_contributor_id
    ORDER BY r.updated_at DESC
  `).all<RequestRow>();
  const eventResult = await env.DB.prepare(`
    SELECT e.*, actor.display_name AS actor_name
    FROM request_events e LEFT JOIN contributors actor ON actor.id = e.actor_contributor_id
    ORDER BY e.created_at ASC
  `).all<Record<string, unknown>>();
  const histories = new Map<string, Record<string, unknown>[]>();
  for (const event of eventResult.results) {
    const id = String(event.request_id);
    histories.set(id, [...(histories.get(id) || []), historyJson(event)]);
  }
  return requestResult.results.map((row) => requestRowToJson(row, histories.get(row.id) || []));
}

async function rawRequestRows(env: Env): Promise<RequestRow[]> {
  return (await env.DB.prepare('SELECT * FROM workflow_requests ORDER BY updated_at DESC').all<RequestRow>()).results;
}

async function publishSnapshot(env: Env): Promise<{ synced: boolean; commitSha?: string; error?: string }> {
  const rows = await rawRequestRows(env);
  const snapshot = requestSnapshot(rows.map((row) => ({ ...row, sync_state: 'synced' })));
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const head = await readRepoHead(env);
      const commitSha = await createCommit(env, head, [requestsTreeEntry(snapshot)], 'REQUESTS: publish shared workflow snapshot');
      if (!(await advanceBranch(env, commitSha))) continue;
      await env.DB.prepare("UPDATE workflow_requests SET sync_state = 'synced' WHERE sync_state = 'pending'").run();
      return { synced: true, commitSha };
    }
    return { synced: false, error: 'The repository changed repeatedly.' };
  } catch (error) {
    return { synced: false, error: error instanceof Error ? error.message : 'Snapshot publishing failed.' };
  }
}

async function validateLinkedRecord(env: Env, linkedRecordId: string): Promise<void> {
  if (!linkedRecordId) return;
  const state = await readRepoState(env);
  const found = state.items.some((item) => String(item.id) === linkedRecordId && !item.archivedAt);
  if (!found) throw new Error('The linked screenshot is not published in the current catalog.');
}

function updateStatements(env: Env, row: RequestRow, event: RequestEventRow): D1PreparedStatement[] {
  return [
    env.DB.prepare(`UPDATE workflow_requests SET
      status = ?, assignee_contributor_id = ?, resolution_note = ?, linked_record_id = ?, version = ?,
      updated_by_contributor_id = ?, updated_at = ?, sync_state = ? WHERE id = ? AND version = ?`)
      .bind(row.status, row.assignee_contributor_id, row.resolution_note, row.linked_record_id, row.version,
        row.updated_by_contributor_id, row.updated_at, row.sync_state, row.id, row.version - 1),
    env.DB.prepare(`INSERT INTO request_events
      (id, request_id, actor_contributor_id, action, before_json, after_json, created_at, request_idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(event.id, event.request_id, event.actor_contributor_id, event.action, event.before_json, event.after_json, event.created_at, event.request_idempotency_key),
  ];
}

export class RequestWriter {
  private tail: Promise<void> = Promise.resolve();

  constructor(private state: DurableObjectState, private env: Env) {
    void this.state;
  }

  fetch(request: Request): Promise<Response> {
    const task = this.tail.then(() => this.handle(request));
    this.tail = task.then(() => undefined, () => undefined);
    return task;
  }

  private async handle(request: Request): Promise<Response> {
    const requestId = request.headers.get('X-Request-Id') || crypto.randomUUID();
    const idempotencyKey = request.headers.get('Idempotency-Key') || '';
    const principal = principalFromRequest(request);
    const publicHash = request.headers.get('X-FDSL-Public-Hash') || '';
    const actorKey = principal?.id || publicHash;
    if (idempotencyKey.length < 16 || !actorKey) return json({ error: 'A valid idempotency key is required.', code: 'IDEMPOTENCY_REQUIRED' }, 400, requestId);

    const completed = await this.env.DB.prepare("SELECT response_json FROM request_operations WHERE key = ? AND actor_key = ? AND status = 'complete'")
      .bind(idempotencyKey, actorKey).first<{ response_json: string }>();
    if (completed?.response_json) return json(JSON.parse(completed.response_json), 200, requestId);
    const claim = await this.env.DB.prepare("INSERT OR IGNORE INTO request_operations (key, actor_key, status, created_at) VALUES (?, ?, 'processing', ?)")
      .bind(idempotencyKey, actorKey, new Date().toISOString()).run();
    if (!claim.meta.changes) return json({ error: 'This request operation is already processing.', code: 'REQUEST_IN_PROGRESS' }, 409, requestId);

    try {
      const url = new URL(request.url);
      let result: Record<string, unknown>;
      if (request.method === 'POST' && url.pathname === '/requests') result = await this.create(await request.json(), publicHash, idempotencyKey);
      else if (request.method === 'PATCH' && /^\/requests\/[^/]+$/.test(url.pathname) && principal) {
        result = await this.update(decodeURIComponent(url.pathname.split('/').pop()!), await request.json(), principal, idempotencyKey);
      } else if (request.method === 'POST' && url.pathname === '/requests/import' && principal?.role === 'owner') result = await this.importSheet(principal, idempotencyKey);
      else if (request.method === 'POST' && url.pathname === '/requests/resync' && principal?.role === 'owner') result = await this.resync();
      else return json({ error: 'Request operation is not allowed.', code: 'REQUEST_OPERATION_DENIED' }, 403, requestId);

      await this.env.DB.prepare("UPDATE request_operations SET status = 'complete', response_json = ?, completed_at = ? WHERE key = ?")
        .bind(JSON.stringify(result), new Date().toISOString(), idempotencyKey).run();
      return json(result, 200, requestId);
    } catch (error) {
      await this.env.DB.prepare("DELETE FROM request_operations WHERE key = ? AND status = 'processing'").bind(idempotencyKey).run();
      if (error instanceof RequestConflictError) return json({ error: error.message, code: 'REQUEST_CONFLICT', latest: requestRowToJson(error.latest) }, 409, requestId);
      const message = error instanceof Error ? error.message : 'Request operation failed.';
      const status = message.includes('not found') ? 404 : message.includes('rate limit') ? 429 : 400;
      return json({ error: message, code: 'REQUEST_OPERATION_FAILED' }, status, requestId);
    }
  }

  private async create(input: Record<string, unknown>, requesterHash: string, idempotencyKey: string): Promise<Record<string, unknown>> {
    const normalized = normalizeRequestInput(input);
    const latest = await this.env.DB.prepare('SELECT created_at FROM workflow_requests WHERE requester_hash = ? ORDER BY created_at DESC LIMIT 1')
      .bind(requesterHash).first<{ created_at: string }>();
    if (latest && Date.now() - Date.parse(latest.created_at) < PUBLIC_RATE_LIMIT_MS) throw new Error('Public request rate limit reached. Please wait before trying again.');
    const now = new Date().toISOString();
    const id = `REQ-${now.slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const row: RequestRow = {
      id, source: 'worker', source_key: id, created_at: now, requester_hash: requesterHash,
      topic: normalized.topic, requested_language: normalized.requestedLanguage, requested_platform: normalized.requestedPlatform,
      description: normalized.description, context: normalized.context, search_terms: normalized.searchTerms,
      status: 'new', assignee_contributor_id: null, resolution_note: null, linked_record_id: null,
      version: 1, updated_by_contributor_id: null, updated_at: now, sync_state: 'pending',
    };
    const event: RequestEventRow = {
      id: crypto.randomUUID(), request_id: id, actor_contributor_id: null, action: 'created', before_json: null,
      after_json: JSON.stringify(row), created_at: now, request_idempotency_key: idempotencyKey,
    };
    await this.env.DB.batch([
      this.env.DB.prepare(`INSERT INTO workflow_requests
        (id, source, source_key, created_at, requester_hash, topic, requested_language, requested_platform, description, context, search_terms,
         status, assignee_contributor_id, resolution_note, linked_record_id, version, updated_by_contributor_id, updated_at, sync_state)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(row.id, row.source, row.source_key, row.created_at, row.requester_hash, row.topic, row.requested_language, row.requested_platform,
          row.description, row.context, row.search_terms, row.status, null, null, null, row.version, null, row.updated_at, row.sync_state),
      this.env.DB.prepare(`INSERT INTO request_events
        (id, request_id, actor_contributor_id, action, before_json, after_json, created_at, request_idempotency_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(event.id, event.request_id, null, event.action, null, event.after_json, event.created_at, event.request_idempotency_key),
    ]);
    const sync = await publishSnapshot(this.env);
    return { ok: true, request: requestRowToJson({ ...row, sync_state: sync.synced ? 'synced' : 'pending' }, [historyJson(event as unknown as Record<string, unknown>)]), sync };
  }

  private async update(id: string, input: Record<string, unknown>, principal: Principal, idempotencyKey: string): Promise<Record<string, unknown>> {
    const before = await this.env.DB.prepare('SELECT * FROM workflow_requests WHERE id = ?').bind(id).first<RequestRow>();
    if (!before) throw new Error('Request was not found.');
    const baseVersion = Number(input.baseVersion);
    const transition = applyRequestTransition(before, input, {
      actorId: principal.id, actorName: principal.displayName, now: new Date().toISOString(), idempotencyKey, eventId: crypto.randomUUID(),
    }, baseVersion);
    if (transition.row.assignee_contributor_id) {
      const assignee = await this.env.DB.prepare("SELECT id FROM contributors WHERE id = ? AND status = 'active'").bind(transition.row.assignee_contributor_id).first();
      if (!assignee) throw new Error('The selected assignee is not active.');
    }
    await validateLinkedRecord(this.env, transition.row.linked_record_id || '');
    const writes = await this.env.DB.batch(updateStatements(this.env, transition.row, transition.event));
    if (!writes[0]?.meta.changes) {
      const latest = await this.env.DB.prepare('SELECT * FROM workflow_requests WHERE id = ?').bind(id).first<RequestRow>();
      throw new RequestConflictError(latest || before);
    }
    const sync = await publishSnapshot(this.env);
    const latest = { ...transition.row, sync_state: sync.synced ? 'synced' as const : 'pending' as const };
    return { ok: true, request: requestRowToJson(latest), sync };
  }

  private async importSheet(principal: Principal, idempotencyKey: string): Promise<Record<string, unknown>> {
    if (!this.env.REQUESTS_SOURCE_URL) throw new Error('REQUESTS_SOURCE_URL is not configured.');
    const response = await fetch(this.env.REQUESTS_SOURCE_URL);
    if (!response.ok) throw new Error(`Sheet import failed with HTTP ${response.status}.`);
    const source = await response.json<unknown>();
    if (!Array.isArray(source)) throw new Error('Sheet import did not return an array.');
    const existing = new Set((await this.env.DB.prepare("SELECT source_key FROM workflow_requests WHERE source = 'sheet_import'").all<{ source_key: string }>()).results.map((row) => row.source_key));
    const rows: RequestRow[] = [];
    let invalid = 0;
    for (const value of source) {
      try {
        const normalized = normalizeSheetRow(value as Record<string, unknown>);
        const sourceKey = await sourceKeyForSheetRow(normalized);
        if (existing.has(sourceKey)) continue;
        const now = normalized.submittedAt && !Number.isNaN(Date.parse(normalized.submittedAt)) ? new Date(normalized.submittedAt).toISOString() : new Date().toISOString();
        rows.push({
          id: `REQ-SHEET-${sourceKey.slice(0, 12).toUpperCase()}`, source: 'sheet_import', source_key: sourceKey, created_at: now,
          requester_hash: normalized.deviceHash || null, topic: normalized.topic, requested_language: normalized.requestedLanguage,
          requested_platform: normalized.requestedPlatform, description: normalized.description, context: normalized.context, search_terms: normalized.searchTerms,
          status: 'new', assignee_contributor_id: null, resolution_note: null, linked_record_id: null, version: 1,
          updated_by_contributor_id: principal.id, updated_at: now, sync_state: 'pending',
        });
      } catch { invalid += 1; }
    }
    const statements: D1PreparedStatement[] = [];
    for (const row of rows) {
      statements.push(this.env.DB.prepare(`INSERT OR IGNORE INTO workflow_requests
        (id, source, source_key, created_at, requester_hash, topic, requested_language, requested_platform, description, context, search_terms,
         status, assignee_contributor_id, resolution_note, linked_record_id, version, updated_by_contributor_id, updated_at, sync_state)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(row.id, row.source, row.source_key, row.created_at, row.requester_hash, row.topic, row.requested_language, row.requested_platform,
          row.description, row.context, row.search_terms, row.status, null, null, null, row.version, principal.id, row.updated_at, row.sync_state));
      statements.push(this.env.DB.prepare(`INSERT OR IGNORE INTO request_events
        (id, request_id, actor_contributor_id, action, before_json, after_json, created_at, request_idempotency_key)
        VALUES (?, ?, ?, 'imported', NULL, ?, ?, ?)`)
        .bind(crypto.randomUUID(), row.id, principal.id, JSON.stringify(row), row.created_at, `${idempotencyKey}:${row.id}`));
    }
    if (statements.length) await this.env.DB.batch(statements);
    const sync = await publishSnapshot(this.env);
    return { ok: true, inserted: rows.length, existing: source.length - rows.length - invalid, invalid, sync };
  }

  private async resync(): Promise<Record<string, unknown>> {
    const sync = await publishSnapshot(this.env);
    return { ok: sync.synced, sync };
  }
}
