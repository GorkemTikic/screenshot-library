import { describe, expect, it } from 'vitest';
import {
  RequestConflictError,
  applyRequestTransition,
  normalizeRequestInput,
  normalizeSheetRow,
  requestRowToJson,
  sourceKeyForSheetRow,
  validateRequestUpdate,
} from '../src/requests';

describe('request workflow domain', () => {
  it('whitelists public input and strips workflow fields', () => {
    expect(normalizeRequestInput({
      topic: ' Futures ', language: 'EN', platform: 'Mobile', description: ' Missing selector ', context: ' chat ',
      status: 'done', linkedRecordId: '7', version: 99, syncState: 'synced',
    })).toEqual({ topic: 'Futures', requestedLanguage: 'EN', requestedPlatform: 'Mobile', description: 'Missing selector', context: 'chat', searchTerms: '' });
  });

  it('normalizes Sheet aliases and produces a deterministic source key', async () => {
    const row = normalizeSheetRow({ submitted_at: '2026-09-01T00:00:00Z', device_hash: 'abc', topic: 'LOAN', language: 'EN', platform: 'Web', description: 'Loan repayment', context: 'urgent', search_terms: 'loan' });
    expect(row.requestedLanguage).toBe('EN');
    expect(row.requestedPlatform).toBe('Web');
    expect(await sourceKeyForSheetRow(row)).toBe(await sourceKeyForSheetRow({ ...row }));
    expect(await sourceKeyForSheetRow({ ...row, description: 'Different' })).not.toBe(await sourceKeyForSheetRow(row));
  });

  it('validates versions and terminal evidence', () => {
    expect(() => validateRequestUpdate({ status: 'done', linkedRecordId: '' }, 2, 1)).toThrow('changed while');
    expect(() => validateRequestUpdate({ status: 'done', linkedRecordId: '' }, 2, 2)).toThrow('published screenshot');
    expect(() => validateRequestUpdate({ status: 'cannot_be_done', resolutionNote: 'short' }, 2, 2)).toThrow('10 characters');
    expect(validateRequestUpdate({ status: 'already_exists', linkedRecordId: '9' }, 2, 2)).toEqual({ status: 'already_exists', linkedRecordId: '9', resolutionNote: '', assigneeContributorId: null });
  });

  it('serializes database rows and parsed history for the frontend', () => {
    const row = {
      id: 'REQ-1', source: 'sheet_import' as const, source_key: 'x', created_at: '2026-09-01', requester_hash: null,
      topic: 'General', requested_language: 'EN', requested_platform: 'Either', description: 'Missing', context: '', search_terms: '',
      status: 'new' as const, assignee_contributor_id: null, assignee_name: null, resolution_note: null, linked_record_id: null,
      version: 1, updated_by_contributor_id: null, updated_by_name: null, updated_at: '2026-09-01', sync_state: 'synced' as const,
    };
    const serialized = requestRowToJson({ ...row, requester_hash: 'private-requester-fingerprint' }, [{ id: 'E1', action: 'created' }]);
    expect(serialized).toMatchObject({ id: 'REQ-1', source: 'sheet_import', requestedLanguage: 'EN', status: 'new', version: 1, history: [{ id: 'E1', action: 'created' }] });
    expect(serialized).not.toHaveProperty('requester_hash');
    expect(serialized).not.toHaveProperty('requesterHash');
  });

  it('applies a versioned transition and emits immutable before/after history', () => {
    const before = {
      id: 'REQ-1', source: 'worker' as const, source_key: 'REQ-1', created_at: '2026-09-01', requester_hash: null,
      topic: 'General', requested_language: 'EN', requested_platform: 'Either', description: 'Missing screenshot', context: '', search_terms: '',
      status: 'new' as const, assignee_contributor_id: null, resolution_note: null, linked_record_id: null,
      version: 1, updated_by_contributor_id: null, updated_at: '2026-09-01', sync_state: 'synced' as const,
    };
    const result = applyRequestTransition(before, { status: 'in_progress', assigneeContributorId: 'enzo' }, {
      actorId: 'owner', actorName: 'CS Gorkem T', now: '2026-09-12T12:00:00Z', idempotencyKey: 'operation-key-1234', eventId: 'E1',
    }, 1);
    expect(result.row).toMatchObject({ status: 'in_progress', assignee_contributor_id: 'enzo', version: 2, sync_state: 'pending' });
    expect(result.event).toMatchObject({ id: 'E1', request_id: 'REQ-1', action: 'status_changed', request_idempotency_key: 'operation-key-1234' });
    expect(JSON.parse(result.event.before_json!)).toMatchObject({ status: 'new', version: 1 });
    expect(JSON.parse(result.event.after_json)).toMatchObject({ status: 'in_progress', version: 2 });
    expect(before.status).toBe('new');
  });

  it('returns the latest row through a structured conflict error', () => {
    const latest = {
      id: 'REQ-1', source: 'worker' as const, source_key: 'REQ-1', created_at: '2026-09-01', requester_hash: null,
      topic: 'General', requested_language: 'EN', requested_platform: 'Either', description: 'Missing screenshot', context: '', search_terms: '',
      status: 'new' as const, assignee_contributor_id: null, resolution_note: null, linked_record_id: null,
      version: 3, updated_by_contributor_id: null, updated_at: '2026-09-01', sync_state: 'synced' as const,
    };
    expect(() => applyRequestTransition(latest, { status: 'in_progress' }, {
      actorId: 'owner', actorName: 'CS Gorkem T', now: '2026-09-12', idempotencyKey: 'operation-key-1234', eventId: 'E1',
    }, 2)).toThrow(RequestConflictError);
    try {
      applyRequestTransition(latest, { status: 'in_progress' }, { actorId: 'owner', actorName: 'CS Gorkem T', now: '2026-09-12', idempotencyKey: 'operation-key-1234', eventId: 'E1' }, 2);
    } catch (error) {
      expect((error as RequestConflictError).latest.version).toBe(3);
    }
  });
});
