import test from 'node:test';
import assert from 'node:assert/strict';

import { latestCatalogUpdate, ownerHue, topicCounts } from '../src/domain/catalog.js';
import { shouldHandleSearchShortcut } from '../src/domain/shortcuts.js';
import { copyPlainText } from '../src/utils/clipboard.js';

test('topicCounts reports visible records for the active platform', () => {
    const counts = topicCounts([
        { topic: 'General' },
        { topic: 'General', platform: 'web' },
        { topic: 'LOAN', platform: 'mobile' },
        { topic: 'LOAN', archivedAt: '2026-01-01' },
    ], 'mobile');
    assert.deepEqual(counts, { General: 1, LOAN: 1 });
});

test('latestCatalogUpdate prefers updatedAt and falls back to numeric id', () => {
    const value = latestCatalogUpdate([
        { id: 1704067200000 },
        { id: 1704153600000, updatedAt: '2026-08-30T10:00:00.000Z' },
        { id: 1704240000000, archivedAt: '2026-09-01' },
    ]);
    assert.equal(value.toISOString(), '2026-08-30T10:00:00.000Z');
});

test('ownerHue is deterministic and stays in a useful hue range', () => {
    assert.equal(ownerHue('CS Gorkem T'), ownerHue('CS Gorkem T'));
    assert.ok(ownerHue('CS Enzo') >= 0 && ownerHue('CS Enzo') < 360);
});

test('search shortcut ignores editable controls and accepts slash or command-k', () => {
    assert.equal(shouldHandleSearchShortcut({ key: '/', metaKey: false, ctrlKey: false, targetTag: 'DIV' }), true);
    assert.equal(shouldHandleSearchShortcut({ key: 'k', metaKey: true, ctrlKey: false, targetTag: 'DIV' }), true);
    assert.equal(shouldHandleSearchShortcut({ key: 'k', metaKey: false, ctrlKey: true, targetTag: 'DIV' }), true);
    assert.equal(shouldHandleSearchShortcut({ key: '/', metaKey: false, ctrlKey: false, targetTag: 'INPUT' }), false);
    assert.equal(shouldHandleSearchShortcut({ key: 'k', metaKey: false, ctrlKey: false, targetTag: 'DIV' }), false);
});

test('copyPlainText uses the secure clipboard API when available', async () => {
    let copied = '';
    const result = await copyPlainText('hello', {
        isSecureContext: true,
        clipboard: { writeText: async (value) => { copied = value; } },
        document: null,
    });
    assert.equal(result, true);
    assert.equal(copied, 'hello');
});
