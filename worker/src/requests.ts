export const REQUEST_STATUSES = ['new', 'in_progress', 'done', 'already_exists', 'cannot_be_done'] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];

export interface RequestRow {
  id: string;
  source: 'worker' | 'sheet_import';
  source_key: string;
  created_at: string;
  requester_hash: string | null;
  topic: string;
  requested_language: string;
  requested_platform: string;
  description: string;
  context: string;
  search_terms: string;
  status: RequestStatus;
  assignee_contributor_id: string | null;
  assignee_name?: string | null;
  resolution_note: string | null;
  linked_record_id: string | null;
  version: number;
  updated_by_contributor_id: string | null;
  updated_by_name?: string | null;
  updated_at: string;
  sync_state: 'synced' | 'pending';
}

export interface RequestInput {
  topic: string;
  requestedLanguage: string;
  requestedPlatform: string;
  description: string;
  context: string;
  searchTerms: string;
}

export interface SheetRequestInput extends RequestInput {
  submittedAt: string;
  deviceHash: string;
}

export interface RequestPatch {
  status: RequestStatus;
  assigneeContributorId: string | null;
  resolutionNote: string;
  linkedRecordId: string;
}

export interface RequestEventRow {
  id: string;
  request_id: string;
  actor_contributor_id: string | null;
  action: string;
  before_json: string | null;
  after_json: string;
  created_at: string;
  request_idempotency_key: string;
}

export class RequestConflictError extends Error {
  constructor(public latest: RequestRow) {
    super('This request changed while you were editing.');
  }
}

const clean = (value: unknown, max = 500): string => String(value ?? '').trim().slice(0, max);

export function normalizeRequestInput(input: Record<string, unknown>): RequestInput {
  const result = {
    topic: clean(input.topic, 80),
    requestedLanguage: clean(input.requestedLanguage ?? input.language ?? input.req_language, 40),
    requestedPlatform: clean(input.requestedPlatform ?? input.platform ?? input.req_platform, 20),
    description: clean(input.description ?? input.req_description, 500),
    context: clean(input.context ?? input.req_context, 300),
    searchTerms: clean(input.searchTerms ?? input.search_terms ?? input.req_search_terms, 200),
  };
  if (!result.topic) throw new Error('Topic is required.');
  if (result.description.length < 10) throw new Error('Description must be at least 10 characters.');
  if (!result.requestedLanguage) throw new Error('Language is required.');
  if (!result.requestedPlatform) throw new Error('Platform is required.');
  return result;
}

export function normalizeSheetRow(input: Record<string, unknown>): SheetRequestInput {
  return {
    ...normalizeRequestInput(input),
    submittedAt: clean(input.submittedAt ?? input.submitted_at ?? input.req_submitted_at, 80),
    deviceHash: clean(input.deviceHash ?? input.device_hash ?? input.device_id, 160),
  };
}

export async function sourceKeyForSheetRow(row: SheetRequestInput): Promise<string> {
  const canonical = [row.submittedAt, row.deviceHash, row.topic, row.requestedLanguage, row.requestedPlatform, row.description]
    .map((value) => clean(value).toLowerCase().replace(/\s+/g, ' ')).join(' | ');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export function validateRequestUpdate(input: Record<string, unknown>, currentVersion: number, baseVersion: number): RequestPatch {
  if (baseVersion !== currentVersion) throw new Error('This request changed while you were editing.');
  const status = REQUEST_STATUSES.includes(input.status as RequestStatus) ? input.status as RequestStatus : 'new';
  const result = {
    status,
    linkedRecordId: clean(input.linkedRecordId ?? input.linked_record_id, 80),
    resolutionNote: clean(input.resolutionNote ?? input.resolution_note, 2000),
    assigneeContributorId: clean(input.assigneeContributorId ?? input.assignee_contributor_id, 100) || null,
  };
  if (['done', 'already_exists'].includes(status) && !result.linkedRecordId) throw new Error('Select a published screenshot before completing this request.');
  if (status === 'cannot_be_done' && result.resolutionNote.length < 10) throw new Error('Resolution note must be at least 10 characters.');
  return result;
}

export function requestRowToJson(row: RequestRow, history: unknown[] = []): Record<string, unknown> {
  return {
    id: row.id,
    source: row.source,
    createdAt: row.created_at,
    topic: row.topic,
    requestedLanguage: row.requested_language,
    requestedPlatform: row.requested_platform,
    description: row.description,
    context: row.context,
    searchTerms: row.search_terms,
    status: row.status,
    assigneeContributorId: row.assignee_contributor_id || '',
    assigneeName: row.assignee_name || '',
    resolutionNote: row.resolution_note || '',
    linkedRecordId: row.linked_record_id || '',
    version: row.version,
    updatedByName: row.updated_by_name || '',
    updatedAt: row.updated_at,
    syncState: row.sync_state,
    history,
  };
}

export function requestSnapshot(rows: RequestRow[]): Record<string, unknown>[] {
  return rows.map((row) => requestRowToJson(row));
}

export function applyRequestTransition(
  before: RequestRow,
  input: Record<string, unknown>,
  metadata: { actorId: string; actorName: string; now: string; idempotencyKey: string; eventId: string },
  baseVersion: number,
): { row: RequestRow; event: RequestEventRow } {
  if (baseVersion !== before.version) throw new RequestConflictError(before);
  const patch = validateRequestUpdate(input, before.version, baseVersion);
  const row: RequestRow = {
    ...before,
    status: patch.status,
    assignee_contributor_id: patch.assigneeContributorId,
    resolution_note: patch.resolutionNote || null,
    linked_record_id: patch.linkedRecordId || null,
    version: before.version + 1,
    updated_by_contributor_id: metadata.actorId,
    updated_by_name: metadata.actorName,
    updated_at: metadata.now,
    sync_state: 'pending',
  };
  return {
    row,
    event: {
      id: metadata.eventId,
      request_id: before.id,
      actor_contributor_id: metadata.actorId,
      action: before.status === row.status ? 'updated' : 'status_changed',
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(row),
      created_at: metadata.now,
      request_idempotency_key: metadata.idempotencyKey,
    },
  };
}
