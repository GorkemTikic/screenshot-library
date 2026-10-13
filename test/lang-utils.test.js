import test from 'node:test';
import assert from 'node:assert/strict';
import { formatUpdatedAt } from '../src/utils/langUtils.js';

test('ISO updatedAt values from Content Studio use the same display form as older records', () => {
    assert.equal(formatUpdatedAt('2026-10-13T14:44:30.994Z', 1, 'Arabic'), '2026-10-13 14:44 UTC+0');
    assert.equal(formatUpdatedAt('2026-10-13T20:05:00.000Z', 1, 'Chinese'), '2026-10-14 04:05 UTC+8');
});

test('display-form values are kept and missing values fall back to the id timestamp', () => {
    assert.equal(formatUpdatedAt('2026-09-02 19:36 UTC+0', 1, 'English'), '2026-09-02 19:36 UTC+0');
    assert.equal(formatUpdatedAt(undefined, Date.UTC(2025, 11, 8, 3, 22), 'English'), '2025-12-08 03:22 UTC+0');
});
