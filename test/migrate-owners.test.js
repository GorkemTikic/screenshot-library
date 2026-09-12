import test from 'node:test';
import assert from 'node:assert/strict';

import { migrateRecord, migrateRecords } from '../scripts/migrate-owners.mjs';

const now = new Date('2026-09-12T12:00:00.000Z');

test('preserves an existing owner and ownership date', () => {
    const input = { id: 1, language: 'English', owner: 'CS VERA', ownerSince: '2026-01-01T00:00:00.000Z' };
    assert.equal(migrateRecord(input, now), input);
});

test('assigns blank owners by approved language mapping', () => {
    const cases = [
        ['English', 'CS Gorkem T'],
        ['Arabic', 'CS Gorkem T'],
        ['Russian', 'CS Gorkem T'],
        ['Vietnamese', 'CS Gorkem T'],
        ['Chinese', 'CS Enzo'],
    ];
    for (const [language, owner] of cases) {
        const result = migrateRecord({ id: 1704067200000, language }, now);
        assert.equal(result.owner, owner);
        assert.equal(result.ownerSince, '2024-01-01T00:00:00.000Z');
    }
});

test('uses parseable updatedAt then execution time as ownership fallback', () => {
    const updated = migrateRecord({ id: 'invalid', language: 'Chinese', updatedAt: '2026-04-03T10:00:00.000Z' }, now);
    const fallback = migrateRecord({ id: 'invalid', language: 'English' }, now);
    assert.equal(updated.ownerSince, '2026-04-03T10:00:00.000Z');
    assert.equal(fallback.ownerSince, now.toISOString());
});

test('leaves an unknown language unassigned', () => {
    const input = { id: 1, language: 'Klingon' };
    assert.equal(migrateRecord(input, now), input);
});

test('migrateRecords preserves length and reports assignment totals', () => {
    const result = migrateRecords([
        { id: 1704067200000, language: 'English' },
        { id: 1704067200001, language: 'Chinese' },
        { id: 1704067200002, language: 'English', owner: 'CS VERA' },
    ], now);
    assert.equal(result.items.length, 3);
    assert.deepEqual(result.assignments, { 'CS Gorkem T': 1, 'CS Enzo': 1 });
    assert.equal(result.preserved, 1);
    assert.equal(result.fallbackDates, 0);
});
