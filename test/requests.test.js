import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REQUEST_STATUSES,
  countRequestsByStatus,
  filterRequests,
  normalizeRequest,
  validateRequestResolution,
} from '../src/domain/requests.js';

test('request statuses and imported fields normalize without losing source data', () => {
  assert.deepEqual(REQUEST_STATUSES, ['new', 'in_progress', 'done', 'already_exists', 'cannot_be_done']);
  assert.deepEqual(normalizeRequest({
    id: 'REQ-1', status: 'unexpected', submitted_at: '2026-09-01T00:00:00Z',
    req_language: 'EN', req_platform: 'Mobile', req_description: 'Missing flow', req_context: 'Chat', req_search_terms: 'margin',
  }), {
    id: 'REQ-1', status: 'new', createdAt: '2026-09-01T00:00:00Z', requestedLanguage: 'EN',
    requestedPlatform: 'Mobile', description: 'Missing flow', context: 'Chat', searchTerms: 'margin',
    topic: '', assigneeContributorId: '', assigneeName: '', resolutionNote: '', linkedRecordId: '',
    version: 1, updatedAt: '2026-09-01T00:00:00Z', updatedByName: '', syncState: 'synced', history: [],
  });
});

test('terminal request states require their resolution evidence', () => {
  assert.equal(validateRequestResolution({ status: 'done' }), 'Select a published screenshot.');
  assert.equal(validateRequestResolution({ status: 'already_exists', linkedRecordId: '42' }), '');
  assert.equal(validateRequestResolution({ status: 'cannot_be_done', resolutionNote: 'too short' }), 'Add a resolution note of at least 10 characters.');
  assert.equal(validateRequestResolution({ status: 'cannot_be_done', resolutionNote: 'No safe route exists.' }), '');
});

test('request counters include zero-valued canonical statuses', () => {
  assert.deepEqual(countRequestsByStatus([{ status: 'new' }, { status: 'done' }, { status: 'done' }]), {
    all: 3, new: 1, in_progress: 0, done: 2, already_exists: 0, cannot_be_done: 0,
  });
});

test('request filtering intersects query, status, topic, language, and assignee', () => {
  const rows = [
    normalizeRequest({ id: '1', status: 'in_progress', topic: 'Futures', requestedLanguage: 'EN', assigneeContributorId: 'enzo', description: 'Margin selector' }),
    normalizeRequest({ id: '2', status: 'done', topic: 'LOAN', requestedLanguage: 'CN', assigneeContributorId: 'vera', description: 'Repayment' }),
  ];
  assert.deepEqual(filterRequests(rows, { query: 'margin', status: 'in_progress', topic: 'Futures', language: 'EN', assignee: 'enzo' }).map((row) => row.id), ['1']);
});
