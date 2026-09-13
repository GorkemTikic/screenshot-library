# Agent Send Mode and Quick Markup — Implementation Plan

**Goal:** Add reliable, one-click screenshot copying beside the existing EN/TR response copy, then let agents crop, annotate, blur, and copy an ephemeral full-resolution image from the inspector.

**Architecture:** Keep catalog data immutable. A pure markup reducer stores normalized vector operations, a canvas renderer converts the source plus those operations into a PNG, and one clipboard service writes that PNG through the browser image clipboard. React owns presentation state; Analytics receives bounded metadata only and owner aggregation separates screenshot copies from response copies.

**Tech stack:** React 19, Vite 7, native Canvas 2D and Clipboard APIs, Node's built-in test runner, Google Apps Script, and Playwright Chromium.

**Design reference:** `docs/superpowers/specs/2026-09-13-agent-send-mode-and-quick-markup-design.md`

## Requirement traceability

| Approved requirement | Delivery task |
|---|---|
| Keep EN/TR response copy and add primary screenshot copy | Task 4 |
| Crop, arrow, number, highlight, blur, undo, redo, reset | Tasks 1, 2, and 5 |
| Full-resolution original and edited PNG clipboard output | Tasks 2 and 7 |
| Ephemeral edits that reset on close/navigation | Tasks 1, 5, and 7 |
| No download fallback and explicit clipboard errors | Tasks 2, 4, and 7 |
| Privacy-safe screenshot-copy and markup Analytics | Task 3 |
| Separate owner screenshot and response copy credit | Tasks 3 and 6 |
| Keyboard, pointer, touch, focus, and narrow-screen behavior | Tasks 5, 6, and 7 |
| Existing search, favorite, lightbox, owner-history, and response-copy regression safety | Tasks 4, 7, and 8 |

## Task 1: Build the pure markup session model

**Files:**

- Create: `src/domain/markup.js`
- Create: `test/markup.test.js`

### Step 1: Write the failing reducer tests

- [ ] Create `test/markup.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarkupSession, isMarkupDirty, markupReducer, markupToolsUsed, nextMarkerNumber } from '../src/domain/markup.js';

const drag = (type, start = { x: 0.1, y: 0.2 }, end = { x: 0.8, y: 0.7 }) => ({ type, start, end });

test('a new markup session is clean', () => {
  const state = createMarkupSession();
  assert.equal(isMarkupDirty(state), false);
  assert.deepEqual(markupToolsUsed(state), []);
  assert.equal(nextMarkerNumber(state), 1);
});

test('committing annotations clamps coordinates and records history', () => {
  const state = markupReducer(createMarkupSession(), {
    type: 'commit', operation: drag('arrow', { x: -1, y: 0.2 }, { x: 2, y: 0.7 }),
  });
  assert.deepEqual(state.operations[0], {
    id: 'markup-1', type: 'arrow', start: { x: 0, y: 0.2 }, end: { x: 1, y: 0.7 },
  });
  assert.equal(state.past.length, 1);
  assert.equal(isMarkupDirty(state), true);
});

test('crop replaces the prior crop and remains undoable', () => {
  const first = markupReducer(createMarkupSession(), { type: 'commit', operation: drag('crop') });
  const second = markupReducer(first, {
    type: 'commit', operation: drag('crop', { x: 0.25, y: 0.25 }, { x: 0.75, y: 0.8 }),
  });
  assert.deepEqual(second.crop, { x: 0.25, y: 0.25, width: 0.5, height: 0.55 });
  assert.deepEqual(markupReducer(second, { type: 'undo' }).crop, { x: 0.1, y: 0.2, width: 0.7, height: 0.5 });
});

test('undo, redo, and branching preserve deterministic history', () => {
  const arrow = markupReducer(createMarkupSession(), { type: 'commit', operation: drag('arrow') });
  const highlighted = markupReducer(arrow, { type: 'commit', operation: drag('highlight') });
  const undone = markupReducer(highlighted, { type: 'undo' });
  assert.equal(undone.operations.length, 1);
  assert.equal(markupReducer(undone, { type: 'redo' }).operations.length, 2);
  const branched = markupReducer(undone, { type: 'commit', operation: drag('blur') });
  assert.equal(branched.future.length, 0);
  assert.deepEqual(markupToolsUsed(branched), ['arrow', 'blur']);
});

test('number markers reuse the next visible sequence after undo and reset', () => {
  const one = markupReducer(createMarkupSession(), { type: 'commit', operation: { type: 'number', point: { x: 0.2, y: 0.3 } } });
  const two = markupReducer(one, { type: 'commit', operation: { type: 'number', point: { x: 0.4, y: 0.5 } } });
  assert.deepEqual(two.operations.map((item) => item.number), [1, 2]);
  assert.equal(nextMarkerNumber(markupReducer(two, { type: 'undo' })), 2);
  assert.equal(nextMarkerNumber(markupReducer(two, { type: 'reset' })), 1);
});
```

### Step 2: Prove the test fails

- [ ] Run `node --test test/markup.test.js`.
- [ ] Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/domain/markup.js`.

### Step 3: Implement the reducer

- [ ] Create `src/domain/markup.js`:

```js
const TOOLS = new Set(['crop', 'arrow', 'number', 'highlight', 'blur']);
const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const point = (value = {}) => ({ x: clamp(value.x), y: clamp(value.y) });
const snapshot = (state) => ({ crop: state.crop, operations: state.operations });

function rectangle(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.max(0.001, Math.abs(end.x - start.x)),
    height: Math.max(0.001, Math.abs(end.y - start.y)),
  };
}

export const createMarkupSession = () => ({
  crop: null, operations: [], past: [], future: [], activeTool: null, nextId: 1,
});

export const isMarkupDirty = (state) => Boolean(state.crop || state.operations.length);

export const markupToolsUsed = (state) => [
  ...(state.crop ? ['crop'] : []),
  ...new Set(state.operations.map((operation) => operation.type)),
];

export const nextMarkerNumber = (state) => state.operations
  .filter((operation) => operation.type === 'number')
  .reduce((maximum, operation) => Math.max(maximum, operation.number), 0) + 1;

function commit(state, raw) {
  if (!TOOLS.has(raw?.type)) return state;
  const base = { id: `markup-${state.nextId}`, type: raw.type };
  const operation = raw.type === 'number'
    ? { ...base, point: point(raw.point), number: nextMarkerNumber(state) }
    : { ...base, start: point(raw.start), end: point(raw.end) };
  const next = { ...state, past: [...state.past, snapshot(state)], future: [], nextId: state.nextId + 1 };
  if (operation.type === 'crop') return { ...next, crop: rectangle(operation.start, operation.end) };
  return { ...next, operations: [...state.operations, operation] };
}

export function markupReducer(state, action) {
  if (action.type === 'select-tool') return { ...state, activeTool: action.tool || null };
  if (action.type === 'commit') return commit(state, action.operation);
  if (action.type === 'reset' && isMarkupDirty(state)) {
    return { ...state, crop: null, operations: [], past: [...state.past, snapshot(state)], future: [] };
  }
  if (action.type === 'undo' && state.past.length) {
    const previous = state.past.at(-1);
    return { ...state, ...previous, past: state.past.slice(0, -1), future: [snapshot(state), ...state.future] };
  }
  if (action.type === 'redo' && state.future.length) {
    const [next, ...future] = state.future;
    return { ...state, ...next, past: [...state.past, snapshot(state)], future };
  }
  return state;
}
```

### Step 4: Run green and commit

- [ ] Run `node --test test/markup.test.js`.
- [ ] Expected: 5 tests pass.
- [ ] Run:

```powershell
git add src/domain/markup.js test/markup.test.js
git commit -m "feat: add quick markup session model"
```

## Task 2: Add the full-resolution renderer and image clipboard service

**Files:**

- Create: `src/utils/markupRenderer.js`
- Create: `src/utils/imageClipboard.js`
- Create: `test/markup-renderer.test.js`
- Create: `test/image-clipboard.test.js`

### Step 1: Write failing geometry and clipboard tests

- [ ] Create `test/markup-renderer.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { outputGeometry, sourcePoint, sourceRectangle } from '../src/utils/markupRenderer.js';

test('full output keeps intrinsic dimensions', () => {
  assert.deepEqual(outputGeometry(1920, 1080, null), { x: 0, y: 0, width: 1920, height: 1080 });
});

test('crop maps normalized coordinates to source pixels', () => {
  assert.deepEqual(outputGeometry(2000, 1000, { x: 0.25, y: 0.1, width: 0.5, height: 0.7 }), { x: 500, y: 100, width: 1000, height: 700 });
});

test('points and rectangles map to source pixels', () => {
  assert.deepEqual(sourcePoint({ x: 0.5, y: 0.25 }, 1200, 800), { x: 600, y: 200 });
  assert.deepEqual(sourceRectangle({ start: { x: 0.1, y: 0.2 }, end: { x: 0.6, y: 0.8 } }, 1000, 500), { x: 100, y: 100, width: 500, height: 300 });
});
```

- [ ] Create `test/image-clipboard.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyClipboardError, writePngToClipboard } from '../src/utils/imageClipboard.js';

test('writes a PNG blob as an image clipboard item', async () => {
  const writes = [];
  class ClipboardItemMock { constructor(value) { this.value = value; } }
  const blob = new Blob(['png'], { type: 'image/png' });
  const result = await writePngToClipboard(() => Promise.resolve(blob), {
    clipboard: { write: async (items) => { await items[0].value['image/png']; writes.push(items); } }, ClipboardItem: ClipboardItemMock, isSecureContext: true,
  });
  assert.deepEqual(result, { ok: true, method: 'clipboard' });
  assert.equal(await writes[0][0].value['image/png'], blob);
});

test('returns unsupported without a download fallback', async () => {
  let rendered = false;
  const result = await writePngToClipboard(() => { rendered = true; return Promise.resolve(new Blob()); }, { clipboard: null, ClipboardItem: null, isSecureContext: true });
  assert.deepEqual(result, { ok: false, method: 'failed', reason: 'unsupported' });
  assert.equal(rendered, false);
});

test('classifies failures into bounded categories', () => {
  assert.equal(classifyClipboardError({ name: 'NotAllowedError' }), 'permission');
  assert.equal(classifyClipboardError({ code: 'IMAGE_DECODE_FAILED' }), 'decode');
  assert.equal(classifyClipboardError({ code: 'IMAGE_ENCODE_FAILED' }), 'encode');
  assert.equal(classifyClipboardError(new Error('write failed')), 'write');
});
```

### Step 2: Prove both tests fail

- [ ] Run `node --test test/markup-renderer.test.js test/image-clipboard.test.js`.
- [ ] Expected: FAIL with `ERR_MODULE_NOT_FOUND` for both utilities.

### Step 3: Implement the canvas renderer

- [ ] Create `src/utils/markupRenderer.js`:

```js
const px = (value, size) => Math.round(value * size);
export const sourcePoint = (point, width, height) => ({ x: px(point.x, width), y: px(point.y, height) });

export function sourceRectangle(operation, width, height) {
  const start = sourcePoint(operation.start, width, height);
  const end = sourcePoint(operation.end, width, height);
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.max(1, Math.abs(end.x - start.x)), height: Math.max(1, Math.abs(end.y - start.y)) };
}

export function outputGeometry(width, height, crop) {
  if (!crop) return { x: 0, y: 0, width, height };
  return { x: px(crop.x, width), y: px(crop.y, height), width: Math.max(1, px(crop.width, width)), height: Math.max(1, px(crop.height, height)) };
}

function drawArrow(context, operation, width, height) {
  const start = sourcePoint(operation.start, width, height);
  const end = sourcePoint(operation.end, width, height);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const lineWidth = Math.max(5, Math.round(Math.min(width, height) * 0.008));
  const head = lineWidth * 4;
  context.save();
  context.strokeStyle = '#ff5c35'; context.fillStyle = '#ff5c35'; context.lineWidth = lineWidth; context.lineCap = 'round';
  context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke();
  context.beginPath(); context.moveTo(end.x, end.y);
  context.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
  context.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
  context.closePath(); context.fill(); context.restore();
}

function drawNumber(context, operation, width, height) {
  const location = sourcePoint(operation.point, width, height);
  const radius = Math.max(18, Math.round(Math.min(width, height) * 0.035));
  context.save(); context.fillStyle = '#ff5c35'; context.beginPath(); context.arc(location.x, location.y, radius, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#fff'; context.font = `700 ${Math.round(radius * 1.15)}px Arial, sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText(String(operation.number), location.x, location.y + 1); context.restore();
}

function drawHighlight(context, operation, width, height) {
  const rect = sourceRectangle(operation, width, height);
  context.save(); context.fillStyle = 'rgba(255, 213, 53, 0.28)'; context.strokeStyle = '#ffd535'; context.lineWidth = Math.max(4, Math.round(Math.min(width, height) * 0.006));
  context.fillRect(rect.x, rect.y, rect.width, rect.height); context.strokeRect(rect.x, rect.y, rect.width, rect.height); context.restore();
}

function drawBlur(context, image, operation, width, height) {
  const rect = sourceRectangle(operation, width, height);
  context.save(); context.beginPath(); context.rect(rect.x, rect.y, rect.width, rect.height); context.clip();
  context.filter = `blur(${Math.max(10, Math.round(Math.min(width, height) * 0.016))}px)`; context.drawImage(image, 0, 0, width, height); context.restore();
}

export function paintMarkup(context, image, session) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  context.clearRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height);
  for (const type of ['blur', 'highlight', 'arrow', 'number']) {
    for (const operation of session.operations.filter((item) => item.type === type)) {
      if (type === 'blur') drawBlur(context, image, operation, width, height);
      if (type === 'highlight') drawHighlight(context, operation, width, height);
      if (type === 'arrow') drawArrow(context, operation, width, height);
      if (type === 'number') drawNumber(context, operation, width, height);
    }
  }
}

const canvasBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob(
  (blob) => blob ? resolve(blob) : reject(Object.assign(new Error('PNG encoding failed'), { code: 'IMAGE_ENCODE_FAILED' })), 'image/png',
));

export async function renderMarkupPng(image, session, documentRef = document) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const source = documentRef.createElement('canvas'); source.width = width; source.height = height;
  paintMarkup(source.getContext('2d'), image, session);
  const geometry = outputGeometry(width, height, session.crop);
  if (!session.crop) return canvasBlob(source);
  const output = documentRef.createElement('canvas'); output.width = geometry.width; output.height = geometry.height;
  output.getContext('2d').drawImage(source, geometry.x, geometry.y, geometry.width, geometry.height, 0, 0, geometry.width, geometry.height);
  return canvasBlob(output);
}
```

### Step 4: Implement image decoding and clipboard writing

- [ ] Create `src/utils/imageClipboard.js`:

```js
import { createMarkupSession } from '../domain/markup.js';
import { renderMarkupPng } from './markupRenderer.js';

export function classifyClipboardError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'permission';
  if (error?.code === 'IMAGE_DECODE_FAILED') return 'decode';
  if (error?.code === 'IMAGE_ENCODE_FAILED') return 'encode';
  return 'write';
}

export async function writePngToClipboard(createBlob, environment = {}) {
  const clipboard = environment.clipboard ?? globalThis.navigator?.clipboard;
  const ClipboardItemClass = environment.ClipboardItem ?? globalThis.ClipboardItem;
  const secure = environment.isSecureContext ?? globalThis.isSecureContext;
  if (!secure || !clipboard?.write || !ClipboardItemClass) return { ok: false, method: 'failed', reason: 'unsupported' };
  try {
    const blobPromise = Promise.resolve().then(createBlob);
    await clipboard.write([new ClipboardItemClass({ 'image/png': Promise.resolve(blobPromise) })]);
    return { ok: true, method: 'clipboard' };
  } catch (error) {
    return { ok: false, method: 'failed', reason: classifyClipboardError(error) };
  }
}

export async function loadScreenshotImage(url, environment = {}) {
  const ImageClass = environment.Image ?? globalThis.Image;
  if (!ImageClass) throw Object.assign(new Error('Image decoding is unavailable'), { code: 'IMAGE_DECODE_FAILED' });
  return new Promise((resolve, reject) => {
    const image = new ImageClass(); image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(Object.assign(new Error('Screenshot could not be decoded'), { code: 'IMAGE_DECODE_FAILED' }));
    image.src = url;
  });
}

export async function copyScreenshot(url, options = {}) {
  const render = options.render || renderMarkupPng;
  return writePngToClipboard(async () => {
    const image = options.image || await loadScreenshotImage(url, options.environment);
    return render(image, options.session || createMarkupSession(), options.environment?.document);
  }, options.environment);
}
```

### Step 5: Run green and commit

- [ ] Run `node --test test/markup-renderer.test.js test/image-clipboard.test.js`.
- [ ] Expected: 6 tests pass.
- [ ] Run `npm test`; expected exit code 0.
- [ ] Run:

```powershell
git add src/utils/markupRenderer.js src/utils/imageClipboard.js test/markup-renderer.test.js test/image-clipboard.test.js
git commit -m "feat: copy full resolution screenshots to clipboard"
```

## Task 3: Extend privacy-safe Analytics and owner aggregation

**Files:**

- Modify: `src/domain/analyticsEvents.js`
- Modify: `src/domain/catalog.js`
- Modify: `apps-script/Code.gs`
- Modify: `apps-script/owner-analytics.gs`
- Modify: `test/analytics-events.test.js`
- Modify: `test/catalog.test.js`
- Modify: `test/apps-script-analytics.test.js`

### Step 1: Write failing frontend event tests

- [ ] Extend the import in `test/analytics-events.test.js`:

```js
import { discoveryEvent, imageCopyEvent, screenshotEvent } from '../src/domain/analyticsEvents.js';
```

- [ ] Append:

```js
test('imageCopyEvent includes bounded outcome data without markup geometry', () => {
  const payload = imageCopyEvent(
    { id: 42, title: 'Guide', topic: 'LOAN', language: 'English', owner: 'CS Gorkem T', ownerKey: 'cs-gorkem-t', platform: 'mobile' },
    { source: 'inspector', ok: true, edited: true, toolsUsed: ['arrow', 'blur', 'arrow'] },
  );
  assert.deepEqual(payload, {
    title: 'Guide', recordId: '42', topic: 'LOAN', contentLanguage: 'English', owner: 'CS Gorkem T', ownerKey: 'cs-gorkem-t',
    contentPlatform: 'mobile', source: 'inspector', method: 'clipboard', success: 'true', edited: 'true', toolsUsed: 'arrow,blur', failureReason: '',
  });
  assert.equal(JSON.stringify(payload).includes('coordinates'), false);
});

test('imageCopyEvent records a bounded failure category', () => {
  const payload = imageCopyEvent({ title: 'Guide' }, { source: 'card', ok: false, reason: 'permission' });
  assert.equal(payload.method, 'failed');
  assert.equal(payload.success, 'false');
  assert.equal(payload.failureReason, 'permission');
  assert.equal(payload.edited, 'false');
});
```

### Step 2: Write failing owner aggregation tests

- [ ] In `test/catalog.test.js`, extend the owner interaction fixture to include:

```js
{
  owner: 'CS Gorkem T', total: '12', copies: '4', responseCopies: '4', imageCopies: '3',
  editedImageCopies: '2', views: '5', lifetime: '7', skippedCollisions: '2',
}
```

- [ ] Add these fields to the matching expected aggregate:

```js
interactions: 12,
copies: 4,
responseCopies: 4,
imageCopies: 3,
editedImageCopies: 2,
```

### Step 3: Write failing Apps Script assertions

- [ ] Append to `test/apps-script-analytics.test.js`:

```js
test('Apps Script stores image-copy outcome dimensions', async () => {
  const source = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  for (const header of ['Edited', 'Tools_Used', 'Success', 'Failure_Reason']) assert.match(source, new RegExp(`"${header}"`));
  for (const parameter of ['params.edited', 'params.toolsUsed', 'params.success', 'params.failureReason']) {
    assert.match(source, new RegExp(parameter.replace('.', '\\.')));
  }
});

test('owner analytics separates successful image and response copies', async () => {
  const source = await readFile(new URL('../apps-script/owner-analytics.gs', import.meta.url), 'utf8');
  assert.match(source, /copy_image/);
  assert.match(source, /imageCopies/);
  assert.match(source, /editedImageCopies/);
  assert.match(source, /responseCopies/);
  assert.match(source, /cSuccess/);
});
```

### Step 4: Prove the tests fail

- [ ] Run `node --test test/analytics-events.test.js test/catalog.test.js test/apps-script-analytics.test.js`.
- [ ] Expected: FAIL for missing `imageCopyEvent`, missing owner fields, and absent Sheet dimensions.

### Step 5: Implement the event builder

- [ ] Append to `src/domain/analyticsEvents.js`:

```js
const COPY_FAILURES = new Set(['permission', 'unsupported', 'decode', 'encode', 'write']);

export const imageCopyEvent = (item = {}, outcome = {}) => ({
  ...screenshotEvent(item, { source: outcome.source || 'card' }),
  method: outcome.ok ? 'clipboard' : 'failed',
  success: outcome.ok ? 'true' : 'false',
  edited: outcome.edited ? 'true' : 'false',
  toolsUsed: [...new Set(outcome.toolsUsed || [])].filter(Boolean).slice(0, 5).join(','),
  failureReason: outcome.ok ? '' : (COPY_FAILURES.has(outcome.reason) ? outcome.reason : 'write'),
});
```

### Step 6: Extend the frontend owner model

- [ ] Replace the current `copies` line in `aggregateOwners()` in `src/domain/catalog.js` with:

```js
copies: Number(interactions.responseCopies ?? interactions.copies ?? interactions.copy_count) || 0,
responseCopies: Number(interactions.responseCopies ?? interactions.copies ?? interactions.copy_count) || 0,
imageCopies: Number(interactions.imageCopies) || 0,
editedImageCopies: Number(interactions.editedImageCopies) || 0,
```

### Step 7: Extend the Apps Script log schema

- [ ] Append these values after `params.ownerKey || ""` in `logSheet.appendRow` in `apps-script/Code.gs`:

```js
params.edited || "",
params.toolsUsed || "",
params.success || "",
params.failureReason || ""
```

- [ ] Append these headers to `LOG_HEADERS` in the same order:

```js
"Edited", "Tools_Used", "Success", "Failure_Reason"
```

### Step 8: Separate owner screenshot and response copies

- [ ] In `apps-script/owner-analytics.gs`, include `copy_image` in `OWNER_USAGE_EVENTS`:

```js
var OWNER_USAGE_EVENTS = ['copy_text', 'copy_image', 'view_image', 'preview_text', 'switch_lang', 'favorite_add', 'right_click_image'];
```

- [ ] Extend `_ensureOwnerAgg_()` with:

```js
copies: 0, responseCopies: 0, imageCopies: 0, editedImageCopies: 0, views: 0,
```

- [ ] Resolve the new columns beside the existing indexes:

```js
var cSuccess = _ownerCol_(header, ['success']);
var cEdited = _ownerCol_(header, ['edited']);
```

- [ ] After reading `eventName`, skip failed screenshot copies:

```js
if (eventName === 'copy_image' && cSuccess >= 0 && String(row[cSuccess]).toLowerCase() !== 'true') continue;
```

- [ ] Replace owner copy increments with:

```js
if (eventName === 'copy_text') { ownerAgg.copies++; ownerAgg.responseCopies++; }
if (eventName === 'copy_image') {
  ownerAgg.imageCopies++;
  if (cEdited >= 0 && String(row[cEdited]).toLowerCase() === 'true') ownerAgg.editedImageCopies++;
}
```

- [ ] Initialize per-record detail with:

```js
{ id: record.id, title: record.title, total: 0, copies: 0, responseCopies: 0, imageCopies: 0, editedImageCopies: 0, views: 0, agents: {}, last: '' }
```

- [ ] Replace detail copy increments with:

```js
if (eventName === 'copy_text') { detail.copies++; detail.responseCopies++; }
if (eventName === 'copy_image') {
  detail.imageCopies++;
  if (cEdited >= 0 && String(row[cEdited]).toLowerCase() === 'true') detail.editedImageCopies++;
}
```

- [ ] Replace the per-record return object with:

```js
return {
  recordId: detail.id, title: detail.title, total: detail.total,
  copies: detail.responseCopies, responseCopies: detail.responseCopies,
  imageCopies: detail.imageCopies, editedImageCopies: detail.editedImageCopies,
  views: detail.views, agents: Object.keys(detail.agents).length, last: detail.last
};
```

- [ ] Replace the owner return object with:

```js
return {
  owner: ownerAgg.owner, ownerKey: ownerAgg.ownerKey, owned: ownerAgg.owned,
  lifetime: Object.keys(ownerAgg.lifetimeIds).length, total: ownerAgg.total,
  copies: ownerAgg.responseCopies, responseCopies: ownerAgg.responseCopies,
  imageCopies: ownerAgg.imageCopies, editedImageCopies: ownerAgg.editedImageCopies,
  views: ownerAgg.views, screenshots: items.length, agents: Object.keys(ownerAgg.agents).length,
  last: ownerAgg.last, lastContribution: ownerAgg.lastContribution,
  skippedCollisions: skippedCollisions, items: items
};
```

- [ ] Replace the `Owner` Sheet header and value mapping with:

```js
var header = ['Owner', 'Owner Key', 'Current Owned', 'Lifetime Contributed', 'Total Uses', 'Copies', 'Response Copies', 'Screenshot Copies', 'Edited Screenshot Copies', 'Views', 'Screenshots Used', 'Distinct Agents', 'Last Used (UTC)', 'Last Contribution (UTC)', 'Skipped Collisions', 'Refreshed (UTC)'];
```

```js
return [row.owner, row.ownerKey, row.owned, row.lifetime, row.total, row.responseCopies, row.responseCopies, row.imageCopies, row.editedImageCopies, row.views, row.screenshots, row.agents, row.last, row.lastContribution, row.skippedCollisions, refreshed];
```

- [ ] Replace the `Owner Details` header and body mapping with:

```js
var header = ['Owner', 'Owner Key', 'Record ID', 'Screenshot', 'Total Uses', 'Copies', 'Response Copies', 'Screenshot Copies', 'Edited Screenshot Copies', 'Views', 'Distinct Agents', 'Last Used (UTC)'];
```

```js
body.push([row.owner, row.ownerKey, item.recordId, item.title, item.total, item.responseCopies, item.responseCopies, item.imageCopies, item.editedImageCopies, item.views, item.agents, item.last]);
```

The legacy `Copies` column remains equal to response copies.

### Step 9: Run green and commit

- [ ] Run `node --test test/analytics-events.test.js test/catalog.test.js test/apps-script-analytics.test.js`; expected all pass.
- [ ] Run `npm test`; expected exit code 0.
- [ ] Run:

```powershell
git add src/domain/analyticsEvents.js src/domain/catalog.js apps-script/Code.gs apps-script/owner-analytics.gs test/analytics-events.test.js test/catalog.test.js test/apps-script-analytics.test.js
git commit -m "feat: track screenshot copy outcomes"
```

## Task 4: Add reusable screenshot-copy controls

**Files:**

- Create: `src/components/ScreenshotCopyButton.jsx`
- Modify: `src/components/ScreenshotCard.jsx`
- Modify: `src/components/Lightbox.jsx`
- Modify: `src/components/AppIcon.jsx`
- Modify: `test/runtime-qa.test.js`

### Step 1: Write a failing source-contract test

- [ ] Append to `test/runtime-qa.test.js`:

```js
test('cards and inspector expose screenshot copy beside response copy', async () => {
  const button = await readFile(new URL('../src/components/ScreenshotCopyButton.jsx', import.meta.url), 'utf8');
  const card = await readFile(new URL('../src/components/ScreenshotCard.jsx', import.meta.url), 'utf8');
  const lightbox = await readFile(new URL('../src/components/Lightbox.jsx', import.meta.url), 'utf8');
  assert.match(button, /copyScreenshot/);
  assert.match(button, /copy_image/);
  assert.match(button, /Screenshot copied/);
  assert.match(button, /Paste it on chat/);
  assert.match(card, /ScreenshotCopyButton/);
  assert.match(lightbox, /ScreenshotCopyButton/);
  assert.match(lightbox, /handleCopy/);
  assert.doesNotMatch(button, /download/i);
});
```

### Step 2: Prove the test fails

- [ ] Run `node --test test/runtime-qa.test.js`.
- [ ] Expected: FAIL because `ScreenshotCopyButton.jsx` does not exist.

### Step 3: Create the reusable copy control

- [ ] Create `src/components/ScreenshotCopyButton.jsx`:

```jsx
import React, { useEffect, useRef, useState } from 'react';
import { isMarkupDirty, markupToolsUsed } from '../domain/markup';
import { imageCopyEvent } from '../domain/analyticsEvents';
import { logEvent } from '../services/analytics';
import { copyScreenshot } from '../utils/imageClipboard';
import { resolveImageUrl } from '../utils/imageUtils';
import { AppIcon } from './AppIcon';

const ERROR_COPY = {
  permission: 'Allow clipboard access and try again.', unsupported: 'This browser cannot copy images directly.',
  decode: 'The screenshot could not be prepared.', encode: 'The screenshot could not be prepared.', write: 'The screenshot could not be copied.',
};

export function ScreenshotCopyButton({ item, source, session, image, className = '' }) {
  const [state, setState] = useState({ status: 'idle', message: '' });
  const runId = useRef(0);
  const edited = Boolean(session && isMarkupDirty(session));
  useEffect(() => () => { runId.current += 1; }, [item.id]);

  const handleCopy = async () => {
    if (state.status === 'pending') return;
    const currentRun = ++runId.current;
    setState({ status: 'pending', message: 'Preparing screenshot…' });
    const outcome = await copyScreenshot(resolveImageUrl(item.image), { session, image });
    if (currentRun !== runId.current) return;
    logEvent('copy_image', imageCopyEvent(item, { source, ...outcome, edited, toolsUsed: edited ? markupToolsUsed(session) : [] }));
    if (outcome.ok) {
      setState({ status: 'success', message: 'Paste it on chat' });
      window.setTimeout(() => currentRun === runId.current && setState({ status: 'idle', message: '' }), 1800);
    } else {
      setState({ status: 'error', message: ERROR_COPY[outcome.reason] || ERROR_COPY.write });
    }
  };

  const label = state.status === 'pending' ? 'Preparing…' : state.status === 'success' ? 'Screenshot copied' : 'Copy Screenshot';
  const statusId = `${source}-copy-status-${item.id}`;
  return <div className={`screenshot-copy ${className}`.trim()}>
    <button type="button" className={`btn btn-screenshot-copy ${state.status}`} onClick={handleCopy} disabled={state.status === 'pending'} aria-describedby={statusId}>
      <AppIcon name={state.status === 'success' ? 'Check' : state.status === 'pending' ? 'LoaderCircle' : 'Images'} size={15} />{label}
    </button>
    <span id={statusId} className={`copy-status ${state.status}`} role="status" aria-live="polite">{state.message}</span>
  </div>;
}
```

### Step 4: Integrate the card

- [ ] Import `ScreenshotCopyButton` in `src/components/ScreenshotCard.jsx`.
- [ ] Replace `.card-actions` contents with:

```jsx
<ScreenshotCopyButton item={item} source="card" />
<button type="button" onClick={handleCopy} className={`btn btn-copy ${copied ? 'copied' : ''}`}>
  <AppIcon name={copied ? 'Check' : 'Copy'} size={15} />
  {copied ? 'Copied' : `Copy ${contentLang === 'tr' ? 'TR' : getLangCode(item.language)}`}
</button>
<button type="button" className="btn-icon" onClick={inspect} aria-label="Inspect screenshot"><AppIcon name="Eye" size={17} /></button>
```

### Step 5: Integrate the clean inspector copy

- [ ] Import `ScreenshotCopyButton` in `src/components/Lightbox.jsx`.
- [ ] Add this as the first child of `.inspector-actions`:

```jsx
<ScreenshotCopyButton item={item} source="inspector" />
```

- [ ] Preserve the response-copy behavior and change only its class so screenshot copy remains visually primary:

```jsx
className={`button button-quiet inspector-response-copy ${copied ? 'is-success' : ''}`}
```

- [ ] Preserve the read-only `Open image` control.

### Step 6: Register and verify the icon

- [ ] Add `Images` to the `lucide-react` import and `ICONS` object in `src/components/AppIcon.jsx`.
- [ ] Run `node --test test/runtime-qa.test.js`; expected all pass.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`; expected exit code 0 for each.
- [ ] Commit:

```powershell
git add src/components/ScreenshotCopyButton.jsx src/components/ScreenshotCard.jsx src/components/Lightbox.jsx src/components/AppIcon.jsx test/runtime-qa.test.js
git commit -m "feat: add screenshot copy actions"
```

## Task 5: Build Quick Markup inside the inspector

**Files:**

- Modify: `src/utils/markupRenderer.js`
- Create: `src/components/QuickMarkupEditor.jsx`
- Modify: `src/components/Lightbox.jsx`
- Modify: `src/components/AppIcon.jsx`
- Modify: `test/runtime-qa.test.js`

### Step 1: Write a failing markup UI contract test

- [ ] Append to `test/runtime-qa.test.js`:

```js
test('the inspector hosts ephemeral accessible quick markup tools', async () => {
  const editor = await readFile(new URL('../src/components/QuickMarkupEditor.jsx', import.meta.url), 'utf8');
  const lightbox = await readFile(new URL('../src/components/Lightbox.jsx', import.meta.url), 'utf8');
  for (const label of ['Crop', 'Arrow', 'Number', 'Highlight', 'Blur', 'Undo', 'Redo', 'Reset']) {
    assert.match(editor, new RegExp(`aria-label="${label}"`));
  }
  assert.match(editor, /onPointerDown/);
  assert.match(editor, /onPointerMove/);
  assert.match(editor, /onPointerUp/);
  assert.match(editor, /metaKey/);
  assert.match(lightbox, /createMarkupSession/);
  assert.match(lightbox, /markupReducer/);
  assert.match(lightbox, /QuickMarkupEditor/);
  assert.match(lightbox, /session=\{markup\}/);
  assert.match(lightbox, /markup_opened/);
});
```

### Step 2: Prove the test fails

- [ ] Run `node --test test/runtime-qa.test.js`.
- [ ] Expected: FAIL because `QuickMarkupEditor.jsx` does not exist.

### Step 3: Add a non-destructive crop preview renderer

- [ ] Append to `src/utils/markupRenderer.js`:

```js
export function paintMarkupPreview(context, image, session) {
  paintMarkup(context, image, session);
  if (!session.crop) return;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const crop = outputGeometry(width, height, session.crop);
  context.save();
  context.fillStyle = 'rgba(5, 6, 8, 0.55)';
  context.fillRect(0, 0, width, crop.y);
  context.fillRect(0, crop.y + crop.height, width, height - crop.y - crop.height);
  context.fillRect(0, crop.y, crop.x, crop.height);
  context.fillRect(crop.x + crop.width, crop.y, width - crop.x - crop.width, crop.height);
  context.strokeStyle = '#ffffff';
  context.lineWidth = Math.max(3, Math.round(Math.min(width, height) * 0.004));
  context.setLineDash([context.lineWidth * 2, context.lineWidth * 1.5]);
  context.strokeRect(crop.x, crop.y, crop.width, crop.height);
  context.restore();
}
```

### Step 4: Create the editor component

- [ ] Create `src/components/QuickMarkupEditor.jsx`:

```jsx
import React, { useEffect, useRef, useState } from 'react';
import { markupReducer } from '../domain/markup';
import { paintMarkupPreview } from '../utils/markupRenderer';
import { AppIcon } from './AppIcon';

const TOOLS = [
  ['crop', 'Crop', 'Crop'], ['arrow', 'Arrow', 'MoveUpRight'], ['number', 'Number', 'CircleDot'],
  ['highlight', 'Highlight', 'Highlighter'], ['blur', 'Blur', 'ScanLine'],
];

function normalizedPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
}

export function QuickMarkupEditor({ imageUrl, session, dispatch, onImageReady }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const gesture = useRef(null);
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      imageRef.current = image;
      const canvas = canvasRef.current;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      onImageReady(image);
      paintMarkupPreview(canvas.getContext('2d'), image, session);
    };
    image.onerror = () => setLoadError('This screenshot cannot be prepared for markup.');
    image.src = imageUrl;
    return () => { image.onload = null; image.onerror = null; };
  }, [imageUrl, onImageReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const visible = preview
      ? markupReducer(session, { type: 'commit', operation: { type: session.activeTool, ...preview } })
      : session;
    paintMarkupPreview(canvas.getContext('2d'), image, visible);
  }, [preview, session]);

  const cancelGesture = () => { gesture.current = null; setPreview(null); };

  const handlePointerDown = (event) => {
    if (!session.activeTool) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = normalizedPoint(event.currentTarget, event);
    if (session.activeTool === 'number') {
      dispatch({ type: 'commit', operation: { type: 'number', point: start } });
      return;
    }
    gesture.current = start;
    setPreview({ start, end: start });
  };

  const handlePointerUp = (event) => {
    if (!gesture.current || !session.activeTool) return;
    const end = normalizedPoint(canvasRef.current, event);
    dispatch({ type: 'commit', operation: { type: session.activeTool, start: gesture.current, end } });
    cancelGesture();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && gesture.current) {
      event.preventDefault(); event.stopPropagation(); cancelGesture(); return;
    }
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    event.preventDefault(); dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
  };

  const reset = () => {
    if (!session.crop && !session.operations.length) return;
    if (window.confirm('Clear all markup from this screenshot?')) dispatch({ type: 'reset' });
  };

  return <div className="markup-editor" onKeyDown={handleKeyDown}>
    <div className="markup-toolbar" role="toolbar" aria-label="Quick Markup">
      <span>Quick Markup</span>
      {TOOLS.map(([tool, label, icon]) => <button
        key={tool} type="button" aria-label={label} aria-pressed={session.activeTool === tool}
        className={session.activeTool === tool ? 'active' : ''}
        onClick={() => dispatch({ type: 'select-tool', tool: session.activeTool === tool ? null : tool })}
      ><AppIcon name={icon} size={15} /><span>{label}</span></button>)}
      <i />
      <button type="button" aria-label="Undo" disabled={!session.past.length} onClick={() => dispatch({ type: 'undo' })}><AppIcon name="Undo2" size={15} /></button>
      <button type="button" aria-label="Redo" disabled={!session.future.length} onClick={() => dispatch({ type: 'redo' })}><AppIcon name="Redo2" size={15} /></button>
      <button type="button" aria-label="Reset" disabled={!session.crop && !session.operations.length} onClick={reset}><AppIcon name="RotateCcw" size={15} /></button>
    </div>
    <div className="markup-stage">
      {loadError ? <div className="markup-error" role="alert">{loadError}</div> : <canvas
        ref={canvasRef} tabIndex="0" aria-label="Screenshot markup canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={(event) => gesture.current && setPreview({ start: gesture.current, end: normalizedPoint(event.currentTarget, event) })}
        onPointerUp={handlePointerUp}
        onPointerCancel={cancelGesture}
      />}
    </div>
  </div>;
}
```

### Step 5: Lift the markup session into the inspector

- [ ] Change the React import in `src/components/Lightbox.jsx` to:

```js
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
```

- [ ] Keep the existing `resolveImageUrl` import and add:

```js
import { createMarkupSession, isMarkupDirty, markupReducer } from '../domain/markup';
import { QuickMarkupEditor } from './QuickMarkupEditor';
```

- [ ] Add state after the existing response-copy state:

```js
const [markup, dispatchMarkup] = useReducer(markupReducer, undefined, createMarkupSession);
const [markupImage, setMarkupImage] = useState(null);
const markupLogged = useRef(false);
const handleImageReady = useCallback((image) => setMarkupImage(image), []);
```

- [ ] Add the one-shot markup Analytics effect:

```js
useEffect(() => {
  if (!isMarkupDirty(markup) || markupLogged.current) return;
  markupLogged.current = true;
  logEvent('markup_opened', screenshotEvent(item, { source: 'inspector' }));
}, [item, markup]);
```

- [ ] Replace the raw `<img>` in `.inspector-media` with:

```jsx
<QuickMarkupEditor imageUrl={resolveImageUrl(item.image)} session={markup} dispatch={dispatchMarkup} onImageReady={handleImageReady} />
```

- [ ] Pass the session and decoded image into inspector copy:

```jsx
<ScreenshotCopyButton item={item} source="inspector" session={markup} image={markupImage} />
```

The existing `key={filteredItems[inspectorIndex].id}` on `Lightbox` creates a clean reducer session after previous/next navigation.

### Step 6: Register markup icons

- [ ] Add `CircleDot`, `Crop`, `Highlighter`, `MoveUpRight`, `Redo2`, `ScanLine`, and `Undo2` to both the `lucide-react` import and the `ICONS` object in `src/components/AppIcon.jsx`.

### Step 7: Run green and commit

- [ ] Run `node --test test/markup.test.js test/runtime-qa.test.js`; expected all pass.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`; expected exit code 0 for each.
- [ ] Commit:

```powershell
git add src/utils/markupRenderer.js src/components/QuickMarkupEditor.jsx src/components/Lightbox.jsx src/components/AppIcon.jsx test/runtime-qa.test.js
git commit -m "feat: add ephemeral quick markup editor"
```

## Task 6: Polish the send workspace and owner metrics

**Files:**

- Modify: `src/index.css`
- Modify: `src/pages/OwnersPage.jsx`
- Modify: `test/runtime-qa.test.js`

### Step 1: Write a failing presentation contract test

- [ ] Append to `test/runtime-qa.test.js`:

```js
test('send mode and quick markup have responsive accessible presentation styles', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const owners = await readFile(new URL('../src/pages/OwnersPage.jsx', import.meta.url), 'utf8');
  assert.match(css, /\.btn-screenshot-copy/);
  assert.match(css, /\.copy-status\.error/);
  assert.match(css, /\.markup-toolbar/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.card-actions/);
  assert.match(owners, /Screenshot copies/);
  assert.match(owners, /Response copies/);
  assert.match(owners, /Edited copies/);
});
```

### Step 2: Prove the test fails

- [ ] Run `node --test test/runtime-qa.test.js`.
- [ ] Expected: FAIL for the new CSS and owner labels.

### Step 3: Add send action styles

- [ ] Add after `.btn-copy.copied` in `src/index.css`:

```css
.screenshot-copy { min-width: 0; flex: 1.15; display: grid; gap: 3px; }
.btn-screenshot-copy { width: 100%; min-height: 36px; color: var(--on-accent); background: var(--accent); border-color: color-mix(in srgb, var(--accent) 78%, black); }
.btn-screenshot-copy:hover { background: var(--accent-hover); }
.btn-screenshot-copy.pending svg { animation: spin 1s linear infinite; }
.btn-screenshot-copy.success { background: var(--positive); border-color: var(--positive); }
.btn-screenshot-copy.error { color: var(--negative); background: var(--negative-soft); border-color: color-mix(in srgb, var(--negative) 35%, var(--line-1)); }
.copy-status { min-height: 11px; padding: 0 4px; color: var(--text-3); font-size: 8.5px; line-height: 1.3; pointer-events: none; }
.copy-status.error { color: var(--negative); }
.card-actions { align-items: flex-start; }
.card-actions > .btn-copy { min-width: 86px; flex: .85; }
.card-actions > .btn-copy:not(.copied) { color: var(--text-1); background: var(--bg-raised); border-color: var(--line-2); }
.card-actions > .btn-copy:not(.copied):hover { background: var(--bg-inset); }
```

### Step 4: Add markup editor styles

- [ ] Add after the inspector rules in `src/index.css`:

```css
.markup-editor { width: 100%; height: 100%; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.markup-toolbar { min-width: 0; display: flex; align-items: center; gap: 5px; padding: 6px; overflow-x: auto; border: 1px solid rgba(255,255,255,.12); border-radius: 10px; background: rgba(25,26,31,.92); color: #fff; scrollbar-width: thin; }
.markup-toolbar > span { margin: 0 5px; font-size: 10px; font-weight: 750; white-space: nowrap; }
.markup-toolbar > i { width: 1px; height: 22px; flex: 0 0 auto; margin: 0 2px; background: rgba(255,255,255,.14); }
.markup-toolbar button { min-width: 32px; min-height: 32px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 6px 8px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: rgba(255,255,255,.7); font-size: 9px; font-weight: 680; cursor: pointer; white-space: nowrap; }
.markup-toolbar button:hover:not(:disabled), .markup-toolbar button.active { border-color: rgba(255,255,255,.16); background: rgba(255,255,255,.1); color: #fff; }
.markup-toolbar button.active { border-color: color-mix(in srgb, var(--accent) 68%, white); background: var(--accent); }
.markup-toolbar button:disabled { opacity: .32; cursor: default; }
.markup-stage { min-width: 0; min-height: 0; flex: 1; display: grid; place-items: center; overflow: hidden; }
.markup-stage canvas { width: auto; height: auto; max-width: 100%; max-height: 100%; display: block; border-radius: 9px; box-shadow: 0 18px 50px rgba(0,0,0,.4); touch-action: none; cursor: crosshair; }
.markup-stage canvas:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.markup-error { padding: 14px; border: 1px solid rgba(255,255,255,.16); border-radius: 9px; color: #fff; background: rgba(217,95,118,.18); }
.inspector-actions .screenshot-copy { flex: 1.15; }
.inspector-actions .inspector-response-copy { flex: .85; }
.inspector-response-copy.is-success { color: #fff; background: var(--positive); border-color: var(--positive); }
```

### Step 5: Add compact-screen behavior

- [ ] Add inside the existing `@media (max-width: 760px)` block:

```css
.card-actions { display: grid; grid-template-columns: 1fr 1fr 36px; }
.inspector-overlay { padding: 0; }
.inspector-shell { width: 100%; height: 100%; grid-template-columns: 1fr; grid-template-rows: minmax(300px, 55vh) minmax(0, 1fr); border-radius: 0; }
.inspector-media { padding: 10px; }
.markup-toolbar button span { display: none; }
.inspector-actions { display: grid; grid-template-columns: 1fr 1fr; }
.inspector-actions .button-quiet { grid-column: 1 / -1; }
```

### Step 6: Separate owner metrics in the profile

- [ ] Replace `.owner-profile-metrics` in `src/pages/OwnersPage.jsx` with:

```jsx
<div className="owner-profile-metrics">
  <div><strong>{active.guides}</strong><span>Current</span></div>
  <div><strong>{active.lifetime}</strong><span>Lifetime</span></div>
  <div><strong>{active.views || '—'}</strong><span>Views</span></div>
  <div><strong>{active.imageCopies || '—'}</strong><span>Screenshot copies</span></div>
  <div><strong>{active.responseCopies || '—'}</strong><span>Response copies</span></div>
  <div><strong>{active.editedImageCopies || '—'}</strong><span>Edited copies</span></div>
  <div><strong>{active.interactions || '—'}</strong><span>Total activity</span></div>
</div>
```

- [ ] Change only the grid columns declaration in the existing `.owner-profile-metrics` CSS rule to:

```css
grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
```

### Step 7: Run green and commit

- [ ] Run `node --test test/runtime-qa.test.js test/catalog.test.js`; expected all pass.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`; expected exit code 0 for each.
- [ ] Commit:

```powershell
git add src/index.css src/pages/OwnersPage.jsx test/runtime-qa.test.js
git commit -m "style: polish agent send mode workspace"
```

## Task 7: Add real-browser clipboard and markup verification

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.js`
- Create: `e2e/agent-send-mode.spec.js`

### Step 1: Install the browser-test dependency

- [ ] Run:

```powershell
npm install --save-dev @playwright/test
npx playwright install chromium
```

- [ ] Expected: `package.json` and `package-lock.json` contain `@playwright/test`; Chromium installation exits 0.

### Step 2: Add the script and configuration

- [ ] Add this entry under `scripts` in `package.json`:

```json
"test:e2e": "playwright test"
```

- [ ] Create `playwright.config.js`:

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5173/screenshot-library/', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173/screenshot-library/',
    reuseExistingServer: true,
  },
});
```

### Step 3: Write secure-context browser tests

- [ ] Create `e2e/agent-send-mode.spec.js`:

```js
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:5173' });
  await page.goto('#/');
  await expect(page.locator('.card').first()).toBeVisible();
});

async function dragAcross(page, canvas, from, to) {
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * from.x, box.y + box.height * from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to.x, box.y + box.height * to.y);
  await page.mouse.up();
}

test('card copies image/png while preserving response copy', async ({ page }) => {
  const card = page.locator('.card').first();
  await expect(card.getByRole('button', { name: 'Copy Screenshot' })).toBeVisible();
  await expect(card.getByRole('button', { name: /^Copy (EN|TR|CN|AR|RU|VI)$/ })).toBeVisible();
  await card.getByRole('button', { name: 'Copy Screenshot' }).click();
  await expect(card.getByRole('button', { name: 'Screenshot copied' })).toBeVisible();
  const types = await page.evaluate(async () => (await navigator.clipboard.read())[0].types);
  expect(types).toContain('image/png');
});

test('quick markup copies edited full-resolution output and resets on navigation', async ({ page }) => {
  await page.locator('.card-image-wrapper').first().click();
  const dialog = page.getByRole('dialog');
  const canvas = dialog.getByLabel('Screenshot markup canvas');
  const clean = await canvas.evaluate((element) => element.toDataURL());
  await dialog.getByRole('button', { name: 'Arrow' }).click();
  await dragAcross(page, canvas, { x: 0.2, y: 0.3 }, { x: 0.7, y: 0.65 });
  const arrow = await canvas.evaluate((element) => element.toDataURL());
  expect(arrow).not.toBe(clean);
  await dialog.getByRole('button', { name: 'Number' }).click();
  await canvas.click({ position: { x: 80, y: 80 } });
  await dialog.getByRole('button', { name: 'Highlight' }).click();
  await dragAcross(page, canvas, { x: 0.15, y: 0.15 }, { x: 0.45, y: 0.35 });
  await dialog.getByRole('button', { name: 'Blur' }).click();
  await dragAcross(page, canvas, { x: 0.55, y: 0.2 }, { x: 0.8, y: 0.4 });
  const edited = await canvas.evaluate((element) => element.toDataURL());
  expect(edited).not.toBe(arrow);
  await dialog.getByRole('button', { name: 'Undo' }).click();
  await dialog.getByRole('button', { name: 'Redo' }).click();
  await dialog.getByRole('button', { name: 'Copy Screenshot' }).click();
  await expect(dialog.getByRole('button', { name: 'Screenshot copied' })).toBeVisible();
  const clipboard = await page.evaluate(async () => {
    const blob = await (await navigator.clipboard.read())[0].getType('image/png');
    const bitmap = await createImageBitmap(blob);
    return { type: blob.type, width: bitmap.width, height: bitmap.height };
  });
  const source = await canvas.evaluate((element) => ({ width: element.width, height: element.height }));
  expect(clipboard).toEqual({ type: 'image/png', width: source.width, height: source.height });
  await dialog.getByRole('button', { name: 'Next screenshot' }).click();
  await expect(dialog.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('crop changes copied dimensions and response language stays independent', async ({ page }) => {
  const translatedCard = page.locator('.card').filter({ has: page.locator('.lang-switch-container') }).first();
  await translatedCard.locator('.card-image-wrapper').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Crop' }).click();
  const canvas = dialog.getByLabel('Screenshot markup canvas');
  await dragAcross(page, canvas, { x: 0.25, y: 0.2 }, { x: 0.75, y: 0.8 });
  await dialog.getByRole('button', { name: 'Copy Screenshot' }).click();
  const dimensions = await page.evaluate(async () => {
    const blob = await (await navigator.clipboard.read())[0].getType('image/png');
    const bitmap = await createImageBitmap(blob);
    return { width: bitmap.width, height: bitmap.height };
  });
  const source = await canvas.evaluate((element) => ({ width: element.width, height: element.height }));
  expect(dimensions.width).toBeCloseTo(source.width * 0.5, -1);
  expect(dimensions.height).toBeCloseTo(source.height * 0.6, -1);
  await dialog.getByRole('button', { name: 'TR' }).click();
  await expect(dialog.getByRole('button', { name: 'Copy TR' })).toBeVisible();
});
```

### Step 4: Run browser and complete verification

- [ ] Run `npm run test:e2e`; expected 3 Chromium tests pass.
- [ ] Run:

```powershell
npm test
npm run test:e2e
npm run lint
npm run build
git diff --check
git status --short
```

- [ ] Expected: tests, lint, and build exit 0; `git diff --check` prints nothing; status contains only intentional feature files.
- [ ] Commit:

```powershell
git add package.json package-lock.json playwright.config.js e2e/agent-send-mode.spec.js
git commit -m "test: verify agent send mode in chromium"
```

## Task 8: Final regression, review, and local handoff

**Files:** Review every file changed since the execution-start SHA. Modify only files required by valid review findings.

### Step 1: Run fresh verification

- [ ] Run:

```powershell
npm test
npm run test:e2e
npm run lint
npm run build
Push-Location worker
npm test
npm run typecheck
Pop-Location
git diff --check
git status --short
```

- [ ] Expected: every test, lint, build, and typecheck command exits 0; `git diff --check` prints nothing.

### Step 2: Perform the required completion review

- [ ] Record the execution-start SHA as `BASE_SHA` and current `HEAD` as `HEAD_SHA`.
- [ ] Invoke `superpowers-code-review` with `BASE_SHA` and `HEAD_SHA`.
- [ ] For each valid blocking or important finding, add a failing regression test, run it to observe failure, implement the minimal correction, and rerun the focused test.
- [ ] Re-run Step 1 after review corrections.

### Step 3: Verify the local experience

- [ ] Open `http://127.0.0.1:5173/screenshot-library/#/`.
- [ ] Copy one original screenshot from a card and paste it into a disposable local image-capable surface.
- [ ] Open the same screenshot and apply one arrow, one numbered marker, one highlight, one blur, and one crop.
- [ ] Exercise undo, redo, and reset; recreate one annotation and copy it.
- [ ] Confirm that closing and reopening the inspector removes all markup.
- [ ] Confirm that EN/TR response copy returns the selected text.
- [ ] Inspect the Analytics request query and confirm that it contains bounded event metadata only.

### Step 4: Hand off without publishing

- [ ] Report the local URL, exact verification results, commits, and browser limitations.
- [ ] Do not push or deploy. Wait for the user to inspect the local feature and explicitly request publication.
