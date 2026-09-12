import test from 'node:test';
import assert from 'node:assert/strict';
import { filterStudioItems, studioCountLabel } from '../src/domain/contentStudio.js';

const records = [
  { id: 1, title: 'Funding history', text: 'Funding copy', owner: 'CS Enzo', topic: 'Futures Trading', language: 'Chinese', platform: 'mobile' },
  { id: 2, title: 'Loan repayment', text: 'Loan copy', owner: 'CS VERA', topic: 'LOAN', language: 'English', platform: 'web' },
  { id: 3, title: 'Archived guide', text: 'Old copy', owner: 'CS Gorkem T', topic: 'General', language: 'English', platform: 'mobile', archivedAt: '2026-09-12' },
];

test('replacement filtering searches every identifying field and excludes archived records', () => {
  for (const query of ['funding', 'enzo', 'futures', 'chinese', 'mobile']) {
    assert.deepEqual(filterStudioItems(records, { query }).map((item) => item.id), [1]);
  }
  assert.deepEqual(filterStudioItems(records, { query: 'archived' }), []);
});

test('studio filtering supports platform and explicit archive mode', () => {
  assert.deepEqual(filterStudioItems(records, { platform: 'web' }).map((item) => item.id), [2]);
  assert.deepEqual(filterStudioItems(records, { archiveMode: true }).map((item) => item.id), [3]);
});

test('studio count labels match the active collection', () => {
  assert.equal(studioCountLabel(2, false), '2 published guides');
  assert.equal(studioCountLabel(1, true), '1 archived guide');
});
