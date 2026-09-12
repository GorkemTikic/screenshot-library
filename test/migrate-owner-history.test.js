import test from 'node:test';
import assert from 'node:assert/strict';

import { initialOwnerHistory, migrateOwnerHistory, migrateOwnerHistoryRecord, ownerKey } from '../scripts/migrate-owner-history.mjs';

test('stable owner keys normalize display names', () => {
  assert.equal(ownerKey('CS Görkem T'), 'cs-gorkem-t');
  assert.equal(ownerKey(' CS VERA '), 'cs-vera');
});

test('Gorkem and Enzo begin all-time while Vera begins at preserved ownerSince', () => {
  assert.equal(initialOwnerHistory({ owner: 'CS Gorkem T', ownerSince: '2026-01-01' })[0].from, null);
  assert.equal(initialOwnerHistory({ owner: 'CS Enzo', ownerSince: '2026-01-01' })[0].from, null);
  assert.equal(initialOwnerHistory({ owner: 'CS VERA', ownerSince: '2026-09-02T19:36:27.182Z' })[0].from, '2026-09-02T19:36:27.182Z');
});

test('owner-history migration is idempotent and preserves compatibility fields', () => {
  const input = { id: 1, owner: 'CS VERA', ownerSince: '2026-09-02T19:36:27.182Z' };
  const once = migrateOwnerHistoryRecord(input);
  const twice = migrateOwnerHistoryRecord(once);
  assert.deepEqual(twice, once);
  assert.equal(once.owner, input.owner);
  assert.equal(once.ownerSince, input.ownerSince);
  assert.equal(once.ownerKey, 'cs-vera');
  assert.equal(once.ownerHistory.length, 1);
});

test('catalog migration reports complete open intervals', () => {
  const result = migrateOwnerHistory([
    { id: 1, owner: 'CS Gorkem T', ownerSince: '2026-01-01' },
    { id: 2, owner: 'CS Enzo', ownerSince: '2026-01-01' },
    { id: 3, owner: 'CS VERA', ownerSince: '2026-09-02' },
  ]);
  assert.deepEqual(result.summary, { total: 3, migrated: 3, preserved: 0, openIntervals: 3 });
});
