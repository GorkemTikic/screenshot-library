import { describe, expect, it } from 'vitest';
import {
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
    expect(requestRowToJson({
      id: 'REQ-1', source: 'sheet_import', source_key: 'x', created_at: '2026-09-01', requester_hash: null,
      topic: 'General', requested_language: 'EN', requested_platform: 'Either', description: 'Missing', context: '', search_terms: '',
      status: 'new', assignee_contributor_id: null, assignee_name: null, resolution_note: null, linked_record_id: null,
      version: 1, updated_by_contributor_id: null, updated_by_name: null, updated_at: '2026-09-01', sync_state: 'synced',
    }, [{ id: 'E1', action: 'created' }])).toMatchObject({ id: 'REQ-1', source: 'sheet_import', requestedLanguage: 'EN', status: 'new', version: 1, history: [{ id: 'E1', action: 'created' }] });
  });
});
