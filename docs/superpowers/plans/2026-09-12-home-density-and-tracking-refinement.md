# Home Density and Tracking Refinement — Implementation Plan

## Goal

Replace the oversized home hero and summary cards with the approved three-beat message and compact live catalog pulse, give every screenshot owner a consistent distinct identity, tighten the gallery cards, and record all meaningful discovery interactions.

## Architecture

Pure catalog and analytics-event helpers remain in `src/domain/` so identity and payload rules can be tested without React. Home and gallery components consume those helpers, while the existing non-blocking `logEvent` transport continues sending events to Apps Script. CSS remains the single visual source for hero, pulse, card density, and owner treatments.

## Tech stack

React 19, Vite 7, plain CSS design tokens, Node test runner, Google Apps Script analytics transport.

## Task 1 — Deterministic owner identities

Files:

- Modify: `test/catalog.test.js`
- Modify: `src/domain/catalog.js`
- Modify: `src/components/ScreenshotCard.jsx`
- Modify: `src/components/Lightbox.jsx`
- Modify: `src/components/admin/ContentList.jsx`
- Modify: `src/pages/OwnersPage.jsx`

Steps:

- [ ] Add the failing contract:

```js
test('approved owners have stable distinct brand hues', () => {
  assert.equal(ownerHue('CS Gorkem T'), 18);
  assert.equal(ownerHue('CS Enzo'), 215);
  assert.equal(ownerHue('CS VERA'), 275);
  assert.equal(ownerHue('New Person'), ownerHue('New Person'));
  assert.equal(new Set(['CS Gorkem T', 'CS Enzo', 'CS VERA'].map(ownerHue)).size, 3);
});
```

- [ ] Run `npm test -- --test-name-pattern="approved owners"`; expect one failing test because named hues are not yet mapped.
- [ ] Implement the fixed palette with deterministic fallback:

```js
const OWNER_HUES = new Map([
  ['cs gorkem t', 18],
  ['cs enzo', 215],
  ['cs vera', 275],
]);

export function ownerHue(name = '') {
  const normalized = String(name).trim().toLowerCase();
  if (OWNER_HUES.has(normalized)) return OWNER_HUES.get(normalized);
  let hash = 0;
  for (const character of normalized) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return ((hash % 360) + 360) % 360;
}

export const ownerColorStyle = (name = '') => {
  const hue = `${ownerHue(name)}deg`;
  return { '--avatar-hue': hue, '--owner-hue': hue };
};
```

- [ ] Replace every local owner-color calculation with `ownerColorStyle(owner)`.
- [ ] Run the full frontend test suite; expect green.
- [ ] Commit: `feat: standardize owner visual identities`.

## Task 2 — Approved hero and compact catalog pulse

Files:

- Modify: `test/runtime-qa.test.js`
- Modify: `src/pages/HomePage.jsx`
- Modify: `src/index.css`

Steps:

- [ ] Add a failing source contract:

```js
test('home hero uses the approved three-beat message and compact pulse', async () => {
  const source = await readFile(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
  assert.match(source, /Find the Shot/);
  assert.match(source, /Copy It/);
  assert.match(source, /Paste It in Chat/);
  assert.match(source, /library-pulse/);
  assert.doesNotMatch(source, /FD knowledge workspace/);
  assert.doesNotMatch(source, /hero-metrics/);
});
```

- [ ] Run the test and confirm it fails on the old hero.
- [ ] Derive `languageCount` from visible catalog records:

```js
const languageCount = useMemo(
  () => new Set(publicItems.map((item) => item.language).filter(Boolean)).size,
  [publicItems],
);
```

- [ ] Render one accessible heading with three animated spans and arrows, followed by this concise support line: `The right visual, the ready response, and one-click copy—without breaking your support flow.`
- [ ] Render `.library-pulse` with live guide count, language count, and latest date.
- [ ] Replace `.hero-metrics` styles with compact pulse styles and reduced-motion-safe beat animation.
- [ ] Run the focused runtime test and full test suite.
- [ ] Commit: `feat: sharpen home hero and catalog pulse`.

## Task 3 — Information-dense screenshot cards

Files:

- Modify: `test/runtime-qa.test.js`
- Modify: `src/components/ScreenshotCard.jsx`
- Modify: `src/index.css`

Steps:

- [ ] Add a failing CSS contract that requires `minmax(255px, 1fr)`, compact card padding, and 36px action targets.
- [ ] Run the focused test and confirm it fails on the current 285px grid.
- [ ] Change the grid and card measurements:

```css
.gallery-grid { grid-template-columns: repeat(auto-fill, minmax(255px, 1fr)); gap: 13px; }
.card-content { padding: 12px; }
.card-title { margin-bottom: 10px; font-size: 14px; }
.owner-row { margin-bottom: 9px; }
.card-actions .btn, .card-actions .btn-icon { min-height: 36px; }
```

- [ ] Combine updated date and owner information without removing topic, language/platform, EN/TR, copy, or inspect controls.
- [ ] Verify the card remains a single column at 390px and has no horizontal overflow.
- [ ] Commit: `feat: increase screenshot card information density`.

## Task 4 — Meaningful interaction analytics

Files:

- Create: `src/domain/analyticsEvents.js`
- Create: `test/analytics-events.test.js`
- Create: `test/apps-script-analytics.test.js`
- Modify: `src/components/ScreenshotCard.jsx`
- Modify: `src/components/ScreenshotGallery.jsx`
- Modify: `src/components/Lightbox.jsx`
- Modify: `apps-script/Code.gs`

Steps:

- [ ] Add failing tests for normalized screenshot metadata and filter/search payloads:

```js
test('screenshotEvent includes stable analysis dimensions', () => {
  assert.deepEqual(screenshotEvent({ title: 'Guide', topic: 'LOAN', language: 'English', owner: 'CS Gorkem T', platform: 'mobile' }, { source: 'card' }), {
    title: 'Guide', topic: 'LOAN', contentLanguage: 'English', owner: 'CS Gorkem T', contentPlatform: 'mobile', source: 'card',
  });
});

test('discoveryEvent records selection and result count', () => {
  assert.deepEqual(discoveryEvent('Futures', 12), { value: 'Futures', resultCount: 12 });
});
```

- [ ] Run `npm test -- --test-name-pattern="analysis dimensions|result count"`; expect module-not-found failure.
- [ ] Implement:

```js
export const screenshotEvent = (item = {}, extra = {}) => ({
  title: item.title || '',
  topic: item.topic || '',
  contentLanguage: item.language || '',
  owner: item.owner || '',
  contentPlatform: item.platform === 'web' ? 'web' : 'mobile',
  ...extra,
});

export const discoveryEvent = (value, resultCount) => ({
  value: String(value || ''),
  resultCount: Number(resultCount) || 0,
});
```

- [ ] Use `screenshotEvent` for view, copy, language, favorite add/remove, right-click, and inspector events.
- [ ] Add a 600ms debounced `search_commit` effect for queries of at least two characters.
- [ ] Emit filter events from platform, topic, language, and favorites controls with the post-selection result count.
- [ ] Emit `inspector_navigate` with direction and destination screenshot metadata.
- [ ] Add a failing Apps Script contract requiring `DB_Logs` columns for `Value`, `Result_Count`, `Owner`, `Content_Language`, `Content_Platform`, `Source`, and `Direction`.
- [ ] Extend the existing log header and append row in the same order. Existing first eight columns remain unchanged so owner analytics and historical reports stay compatible.
- [ ] Keep the transport fire-and-forget so analytics cannot block UI actions.
- [ ] Run all frontend tests, lint, and build.
- [ ] Commit: `feat: expand meaningful discovery analytics`.

## Task 5 — Browser QA and final verification

Files:

- No production file changes expected.

Steps:

- [ ] Use the running localhost app to inspect desktop home, owner colors, card density, copy, language switch, filters, and inspector navigation.
- [ ] Resize to 390×844 and confirm `scrollWidth === clientWidth`.
- [ ] Confirm no browser console errors from the updated public flow.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`; expect success.
- [ ] Run Worker tests, typecheck, and deploy dry-run; expect success because shared publishing behavior must remain unchanged.
- [ ] Confirm `git diff --check` is clean and keep the branch local without push or deploy.
