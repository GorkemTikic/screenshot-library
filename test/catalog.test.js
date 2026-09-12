import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TOPIC_META,
  aggregateOwners,
  buildPatch,
  filterCatalog,
  normalizePlatform,
  ownerHue,
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

test('approved owners have stable distinct brand hues', () => {
  assert.equal(ownerHue('CS Gorkem T'), 18);
  assert.equal(ownerHue('CS Enzo'), 215);
  assert.equal(ownerHue('CS VERA'), 275);
  assert.equal(ownerHue('New Person'), ownerHue('New Person'));
  assert.equal(new Set(['CS Gorkem T', 'CS Enzo', 'CS VERA'].map(ownerHue)).size, 3);
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

test('aggregateOwners combines catalog coverage and interaction rows', () => {
  const result = aggregateOwners([
    { id: 3, owner: 'CS Gorkem T', language: 'English', topic: 'General', updatedAt: '2026-09-01' },
    { id: 2, owner: 'CS Gorkem T', language: 'Chinese', topic: 'BOTS', updatedAt: '2026-08-01' },
    { id: 1, owner: 'CS Enzo', language: 'Chinese', topic: 'General', updatedAt: '2026-07-01' },
  ], [{ owner: 'CS Gorkem T', total: '9', copies: '4', views: '5' }]);
  assert.deepEqual({ ...result[0], latest: undefined }, {
    owner: 'CS Gorkem T', guides: 2, interactions: 9, copies: 4, views: 5,
    languages: ['Chinese', 'English'], topics: ['BOTS', 'General'], latest: undefined,
  });
  assert.equal(result[0].latest, '2026-09-01');
  assert.equal(result[1].owner, 'CS Enzo');
});
