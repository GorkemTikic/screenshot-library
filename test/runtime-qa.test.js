import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

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

test('the owner import is connected to the existing read-only Sheet endpoint', async () => {
  const config = await readFile(new URL('../worker/wrangler.toml', import.meta.url), 'utf8');
  assert.match(config, /REQUESTS_SOURCE_URL\s*=\s*"https:\/\/script\.google\.com\/macros\/s\/[^"]+\/exec\?getRequests=true"/);
});

test('the Pages build receives the deployed Screenshot Library Worker URL', async () => {
  const workflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(workflow, /VITE_CONTENT_API_URL:\s*\$\{\{\s*vars\.VITE_CONTENT_API_URL\s*\}\}/);
});

test('the production Worker binds a real dedicated D1 database', async () => {
  const config = await readFile(new URL('../worker/wrangler.toml', import.meta.url), 'utf8');
  assert.doesNotMatch(config, /database_id\s*=\s*"00000000-0000-0000-0000-000000000000"/);
});

test('catalog publishing protects image conflicts and restores historical blobs', async () => {
  const publisher = await readFile(new URL('../worker/src/publisher.ts', import.meta.url), 'utf8');
  assert.match(publisher, /assertCatalogMutationIsCurrent/);
  assert.match(publisher, /readHistoricalImageBlobSha/);
  assert.match(publisher, /imageTreeEntry\(priorImage, historicalBlobSha\)/);
});

test('production login and catalog publishing are rate limited server-side', async () => {
  const index = await readFile(new URL('../worker/src/index.ts', import.meta.url), 'utf8');
  const publisher = await readFile(new URL('../worker/src/publisher.ts', import.meta.url), 'utf8');
  assert.match(index, /consumeRateLimit[\s\S]+LOGIN_RATE_LIMIT/);
  assert.match(publisher, /consumeRateLimit[\s\S]+PUBLISH_RATE_LIMIT/);
});

test('authenticated request workflow publishing uses the contributor publish limit', async () => {
  const worker = await readFile(new URL('../worker/src/request-writer.ts', import.meta.url), 'utf8');
  assert.match(worker, /consumeRateLimit[\s\S]*PUBLISH_RATE_LIMIT/);
  assert.match(worker, /rateLimitKey\(['"]publish['"], principal\.id\)/);
});

test('established owner identities are linked by a follow-up production migration', async () => {
  const migration = await readFile(new URL('../worker/migrations/0004_owner_identity_links.sql', import.meta.url), 'utf8');
  assert.match(migration, /cs-gorkem-t/);
  assert.match(migration, /cs-enzo/);
  assert.match(migration, /cs-vera/);
});

test('owners can expose archived records and initiate recovery in Content Studio', async () => {
  const list = await readFile(new URL('../src/components/admin/ContentList.jsx', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../src/components/admin/ContentEditor.jsx', import.meta.url), 'utf8');
  assert.match(list, /Show archived/);
  assert.match(editor, /action:\s*'rollback'/);
  assert.match(editor, /Restore to library|Restore previous version/);
});

test('every literal AppIcon name is registered instead of silently falling back', async () => {
  const sourceRoot = new URL('../src/', import.meta.url);
  const files = (await readdir(sourceRoot, { recursive: true })).filter((file) => file.endsWith('.jsx'));
  const used = new Set();
  for (const file of files) {
    const source = await readFile(new URL(file.replaceAll('\\', '/'), sourceRoot), 'utf8');
    for (const match of source.matchAll(/<AppIcon\s+[^>]*name="([^"]+)"/g)) used.add(match[1]);
  }
  const registry = await readFile(new URL('../src/components/AppIcon.jsx', import.meta.url), 'utf8');
  const registered = registry.match(/const ICONS = \{([\s\S]*?)\};/)?.[1] || '';
  for (const icon of used) assert.match(registered, new RegExp(`\\b${icon}\\b`), `${icon} must be registered in AppIcon`);
});

test('existing screenshot picker makes replacement selection searchable and explicit', async () => {
  const picker = await readFile(new URL('../src/components/admin/ExistingScreenshotPicker.jsx', import.meta.url), 'utf8');
  assert.match(picker, /Choose a screenshot to replace/);
  assert.match(picker, /filterStudioItems/);
  assert.match(picker, /title, owner, topic, language or platform/i);
  assert.match(picker, /item\.topic/);
  assert.match(picker, /item\.language/);
  assert.match(picker, /normalizePlatform\(item\.platform\)/);
  assert.match(picker, /item\.owner/);
  assert.match(picker, /Select \$\{item\.title\} to replace/);
  assert.match(picker, /loading="lazy"/);
  assert.match(picker, /previouslyFocused/);
  assert.match(picker, /querySelectorAll/);
  assert.match(picker, /event\.key === 'Tab'/);
  assert.match(picker, /previouslyFocused\?\.focus/);
});

test('Content Studio separates create and replace flows and recovers from the wrong entry point', async () => {
  const page = await readFile(new URL('../src/pages/AdminPage.jsx', import.meta.url), 'utf8');
  const list = await readFile(new URL('../src/components/admin/ContentList.jsx', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../src/components/admin/ContentEditor.jsx', import.meta.url), 'utf8');
  const imageField = await readFile(new URL('../src/components/admin/ImageReplaceField.jsx', import.meta.url), 'utf8');
  assert.match(page, /ExistingScreenshotPicker/);
  assert.match(page, /onReplace=\{openReplace\}/);
  assert.match(list, /Replace existing/);
  assert.match(list, /Create new/);
  assert.match(list, /studioCountLabel/);
  assert.match(list, /button button-primary[^>]+onClick=\{onReplace\}/);
  assert.match(list, /Replace or edit \$\{item\.title\}/);
  assert.doesNotMatch(list, /Edit & replace/);
  assert.match(editor, /Choose existing/);
  assert.match(editor, /Updating something already published/);
  assert.match(editor, /Publish new screenshot/);
  assert.match(editor, /Publish changes/);
  assert.match(imageField, /currentImage\s*&&\s*<figure/);
  assert.match(imageField, /studio-image-previews \$\{currentImage \? '' : 'is-create'\}/);
  assert.match(imageField, /currentImage\s*\?/);
  assert.match(imageField, /validated before publishing/);
  assert.match(imageField, /previous image is removed/);
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.image-upload-button input\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.image-upload-button:focus-within/);
  assert.match(await readFile(new URL('../src/components/admin/ExistingScreenshotPicker.jsx', import.meta.url), 'utf8'), /results\.length === 1 \? '' : 's'/);
});

test('the production migration stores immutable owner keys and rate-limit buckets', async () => {
  const migration = await readFile(new URL('../worker/migrations/0003_production_safety.sql', import.meta.url), 'utf8');
  assert.match(migration, /owner_key/);
  assert.match(migration, /CREATE UNIQUE INDEX contributors_owner_key_idx/);
  assert.match(migration, /CREATE TABLE rate_limits/);
});
