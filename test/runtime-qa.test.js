import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('image placeholder styles remain scoped to their component', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /^\.image-placeholder\s*\{/m);
});

test('the development server exposes the same live catalog URL as production', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /configureServer/);
  assert.match(config, /data\.json/);
});

test('market ticker does not call a browser-blocked news endpoint', async () => {
  const source = await readFile(new URL('../src/components/MarketTicker.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /cryptocompare/i);
});

test('page entrance animation releases its transform so fixed dialogs use the viewport', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const rule = css.match(/\.animate-in\s*\{[^}]+\}/)?.[0] || '';
  assert.doesNotMatch(rule, /\bboth\b/);
});

test('analytics charts declare zero-safe responsive dimensions', async () => {
  const source = await readFile(new URL('../src/pages/AnalyticsPage.jsx', import.meta.url), 'utf8');
  const containers = source.match(/<ResponsiveContainer[^>]+>/g) || [];
  assert.equal(containers.length, 2);
  containers.forEach((container) => {
    assert.match(container, /minWidth=\{0\}/);
    assert.match(container, /minHeight=\{0\}/);
  });
});

test('home hero uses the approved three-beat message and compact pulse', async () => {
  const source = await readFile(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
  assert.match(source, /Find the Shot/);
  assert.match(source, /Copy It/);
  assert.match(source, /Paste It in Chat/);
  assert.match(source, /library-pulse/);
  assert.doesNotMatch(source, /FD knowledge workspace/);
  assert.doesNotMatch(source, /hero-metrics/);
});
