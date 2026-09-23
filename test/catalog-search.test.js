import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterCatalog } from '../src/domain/catalog.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/data.json', import.meta.url), 'utf8'));
const titles = (items) => items.map((item) => item.title);

test('Funding puts every matching title and language variant before response-only matches', () => {
    const expected = catalog.filter((item) => !item.archivedAt && item.platform !== 'web' && /funding/i.test(item.title));
    const results = filterCatalog(catalog, { query: 'Funding' });
    assert.equal(expected.length, 6);
    assert.deepEqual(new Set(titles(results.slice(0, expected.length))), new Set(titles(expected)));
    assert.ok(results.slice(expected.length).every((item) => /funding/i.test(`${item.text} ${item.text_tr}`)));
    assert.ok(!titles(results).includes('Close Open Position on Stopped Grid - EN'));
});

test('Funding with English filter starts with the three relevant guides', () => {
    const results = filterCatalog(catalog, { query: 'Funding', language: 'English' });
    assert.deepEqual(new Set(titles(results.slice(0, 3))), new Set([
        'What Is Funding Rate? - EN', 'Funding Fee History - EN', 'Futures Notification for TP/SL/Funding - EN',
    ]));
});

const fixtures = [
    { id: 1, title: 'Funding Fee History - EN', topic: 'Futures Trading', language: 'English' },
    { id: 2, title: 'Futures Notification for TP/SL/Funding - AR', language: 'Arabic' },
    { id: 30, title: 'Margin alerts', text: 'Funding fee notifications are available.', language: 'English' },
    { id: 40, title: 'Running bots', text: 'Find your running grid.' },
    { id: 50, title: 'Funding archive', archivedAt: '2026-01-01' },
    { id: 60, title: 'Funding web', platform: 'web' },
];

test('exact phrases and all title words outrank response mentions regardless of age', () => {
    assert.deepEqual(titles(filterCatalog(fixtures, { query: 'funding fee' })), ['Funding Fee History - EN', 'Margin alerts']);
    assert.deepEqual(titles(filterCatalog(fixtures, { query: 'history funding' })), ['Funding Fee History - EN']);
    assert.deepEqual(titles(filterCatalog(fixtures, { query: 'funding missing' })), []);
});

test('supports case, whitespace, punctuation and unfinished title words', () => {
    assert.deepEqual(titles(filterCatalog(fixtures, { query: '  FUNDING   FEE  ' })), ['Funding Fee History - EN', 'Margin alerts']);
    assert.deepEqual(titles(filterCatalog(fixtures, { query: 'tp sl funding' })), ['Futures Notification for TP/SL/Funding - AR']);
    assert.deepEqual(titles(filterCatalog(fixtures, { query: 'funding hist' })), ['Funding Fee History - EN']);
});

test('typo fallback searches titles, requires every term, and respects the active filters', () => {
    assert.deepEqual(titles(filterCatalog(fixtures, { query: 'fundng', language: 'English' })), ['Funding Fee History - EN']);
    assert.deepEqual(titles(filterCatalog(fixtures, { query: 'fundng history' })), ['Funding Fee History - EN']);
    assert.deepEqual(titles(filterCatalog(fixtures, { query: 'fundng missing' })), []);
    assert.deepEqual(titles(filterCatalog(fixtures, { query: 'fundng', platform: 'web' })), ['Funding web']);
    const scoped = [{ id: 1, title: 'Fundng', platform: 'web' }, ...fixtures];
    assert.deepEqual(titles(filterCatalog(scoped, { query: 'fundng', language: 'English' })), ['Funding Fee History - EN']);
});

test('metadata, translated responses and non-Latin scripts remain searchable', () => {
    const items = [
        { id: 1, title: 'Guide', owner: 'CS Görkem T', text_tr: 'Fonlama ücreti geçmişi' },
        { id: 2, title: 'Funding 资金费用历史 - CN' },
        { id: 3, title: 'دليل التمويل' },
    ];
    assert.deepEqual(titles(filterCatalog(items, { query: 'gorkem' })), ['Guide']);
    assert.deepEqual(titles(filterCatalog(items, { query: 'FONLAMA UCRETI' })), ['Guide']);
    assert.deepEqual(titles(filterCatalog(items, { query: '资金费用' })), ['Funding 资金费用历史 - CN']);
    assert.deepEqual(titles(filterCatalog(items, { query: 'التمويل' })), ['دليل التمويل']);
});

test('blank searches retain newest-first browsing and all filters still intersect', () => {
    for (const query of ['', '   ', ' / ']) {
        assert.deepEqual(filterCatalog(fixtures, { query }).map((item) => item.id), [40, 30, 2, 1]);
    }
    assert.deepEqual(filterCatalog(fixtures, { query: 'Funding', favoritesOnly: true, favoriteTitles: ['Funding Fee History - EN'], topic: 'Futures Trading' }).map((item) => item.id), [1]);
    assert.deepEqual(filterCatalog(fixtures, { query: 'Funding', language: 'Arabic' }).map((item) => item.id), [2]);
    assert.deepEqual(filterCatalog(fixtures, { query: 'Funding', platform: 'web' }).map((item) => item.id), [60]);
});

test('short queries do not fuzzy-match unrelated titles and empty results stay empty', () => {
    assert.deepEqual(filterCatalog(fixtures, { query: 'xyz' }), []);
    assert.deepEqual(filterCatalog(fixtures, { query: 'zzzzzzzzz' }), []);
    assert.deepEqual(filterCatalog([], { query: 'funding' }), []);
});
