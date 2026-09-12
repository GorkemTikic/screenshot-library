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
  assert.match(config, /liveDataFiles\.get\(pathname\)/);
  assert.doesNotMatch(config, /pathname\.endsWith/);
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
    assert.match(container, /initialDimension=\{\{ width: 480, height: 300 \}\}/);
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

test('screenshot cards use the compact information-dense grid', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /\.gallery-grid\s*\{[^}]*minmax\(255px,\s*1fr\)[^}]*gap:\s*13px/s);
  assert.match(css, /\.card-content\s*\{[^}]*padding:\s*12px/s);
  assert.match(css, /\.card-actions \.btn, \.card-actions \.btn-icon\s*\{[^}]*min-height:\s*36px/s);
});

test('inspector media can shrink and contains the complete image on both axes', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const media = css.match(/\.inspector-media\s*\{[^}]+\}/)?.[0] || '';
  const image = css.match(/\.inspector-media img\s*\{[^}]+\}/)?.[0] || '';
  assert.match(media, /min-height:\s*0/);
  assert.match(media, /overflow:\s*hidden/);
  assert.match(image, /width:\s*100%/);
  assert.match(image, /height:\s*100%/);
  assert.match(image, /min-width:\s*0/);
  assert.match(image, /min-height:\s*0/);
  assert.match(image, /object-fit:\s*contain/);
});

test('request updates return hydrated metadata and the catalog link picker is searchable', async () => {
  const worker = await readFile(new URL('../worker/src/request-writer.ts', import.meta.url), 'utf8');
  const workflow = await readFile(new URL('../src/components/requests/RequestWorkflow.jsx', import.meta.url), 'utf8');
  assert.match(worker, /listWorkflowRequests\(this\.env\)/);
  assert.match(workflow, /Search published screenshots/);
  assert.match(workflow, /mergeConflictDraft/);
});
