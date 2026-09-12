import test from 'node:test';
import assert from 'node:assert/strict';

import { getInitialTheme, nextTheme } from '../src/domain/theme.js';
import { buildTickerItems, formatTickerPrice } from '../src/domain/ticker.js';

test('theme preference uses a valid stored value and otherwise defaults light', () => {
    assert.equal(getInitialTheme('dark'), 'dark');
    assert.equal(getInitialTheme('light'), 'light');
    assert.equal(getInitialTheme('sepia'), 'light');
    assert.equal(getInitialTheme(null), 'light');
    assert.equal(nextTheme('light'), 'dark');
    assert.equal(nextTheme('dark'), 'light');
});

test('ticker builder skips missing prices and invalid news links', () => {
    const items = buildTickerItems(
        { bitcoin: { usd: 65000, usd_24h_change: 1.25 }, ethereum: {} },
        { Data: [
            { title: 'A sufficiently descriptive market update', url: 'https://example.com/a', source_info: { name: 'Desk' } },
            { title: 'Bad URL market update that is long enough', url: 'javascript:alert(1)' },
        ] },
    );
    assert.deepEqual(items, [
        { type: 'price', name: 'BTC', price: 65000, change: 1.25 },
        { type: 'news', text: 'A sufficiently descriptive market update', url: 'https://example.com/a', source: 'Desk' },
    ]);
});

test('ticker price formatting is compact and deterministic', () => {
    assert.equal(formatTickerPrice(97350.12), '$97,350.12');
    assert.equal(formatTickerPrice(null), '—');
});
