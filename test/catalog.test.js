import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TOPIC_META,
  buildPatch,
  filterCatalog,
  normalizePlatform,
  ownerInitials,
  recordVersion,
  visibleCatalog,
} from '../src/domain/catalog.js';

const items = [
  { id: 1, title: 'Mobile funding', topic: 'Futures Trading', language: 'English', owner: 'CS VERA' },
  { id: 3, title: 'Web margin', topic: 'Margin Trading', language: 'Chinese', platform: 'web', owner: 'CS Enzo' },
  { id: 2, title: 'Archived item', topic: 'General', language: 'English', archivedAt: '2026-01-01' },
];

test('normalizes legacy platform values to mobile', () => {
  assert.equal(normalizePlatform(undefined), 'mobile');
  assert.equal(normalizePlatform('mobile'), 'mobile');
  assert.equal(normalizePlatform('web'), 'web');
});

test('visibleCatalog removes archived records', () => {
  assert.deepEqual(visibleCatalog(items).map((item) => item.id), [1, 3]);
});

test('topic metadata covers the seven canonical topics', () => {
  assert.deepEqual(Object.keys(TOPIC_META), [
    'Futures Trading', 'Margin Trading', 'General', 'LOAN', 'Copy Trading', 'Event Contract', 'BOTS',
  ]);
});

test('ownerInitials removes CS prefix and returns two initials', () => {
  assert.equal(ownerInitials('CS Gorkem T'), 'GT');
  assert.equal(ownerInitials('CS Enzo'), 'E');
  assert.equal(ownerInitials(''), '—');
});

test('buildPatch includes only changed fields', () => {
  assert.deepEqual(
    buildPatch({ title: 'Old', text: 'Same' }, { title: 'New', text: 'Same' }, ['title', 'text']),
    { title: 'New' },
  );
});

test('recordVersion uses version, update time, then id', () => {
  assert.equal(recordVersion({ version: 'v3', updatedAt: 'later', id: 1 }), 'v3');
  assert.equal(recordVersion({ updatedAt: 'later', id: 1 }), 'later');
  assert.equal(recordVersion({ id: 1 }), '1');
});

test('filterCatalog intersects search and filters, then sorts newest first', () => {
  const result = filterCatalog(items, {
    matchedIds: new Set([1, 3]),
    platform: 'mobile',
    topic: 'All',
    language: 'All',
    favoritesOnly: true,
    favoriteTitles: ['Mobile funding'],
  });
  assert.deepEqual(result.map((item) => item.id), [1]);
});

test('filterCatalog supports web, topic and language', () => {
  const result = filterCatalog(items, {
    matchedIds: null,
    platform: 'web',
    topic: 'Margin Trading',
    language: 'Chinese',
    favoritesOnly: false,
    favoriteTitles: [],
  });
  assert.deepEqual(result.map((item) => item.id), [3]);
});
