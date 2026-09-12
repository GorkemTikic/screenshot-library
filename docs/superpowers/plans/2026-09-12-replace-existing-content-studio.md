# Replace Existing Screenshot — Implementation Plan

## Goal

Add an explicit, searchable replacement workflow to Content Studio and remove misleading create-mode UI. Preserve all current atomic publishing, ownership, rollback, and conflict behavior.

## Architecture

Pure Content Studio filtering and count-label logic will live in `src/domain/contentStudio.js` and be shared by the main content list and a new `ExistingScreenshotPicker` component. `AdminPage` owns the mutually exclusive picker/editor states; `ContentEditor` receives one callback that switches an empty create flow into the picker. The Worker API and catalog schema remain unchanged.

## Tech stack

React 19, Vite, plain CSS, Node test runner, existing catalog domain utilities, and the existing Content Studio publishing client.

## Task 1 — Shared selection logic

**Files:**

- Create: `test/content-studio.test.js`
- Create: `src/domain/contentStudio.js`

- [ ] Add failing tests:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterStudioItems, studioCountLabel } from '../src/domain/contentStudio.js';

const records = [
  { id: 1, title: 'Funding history', owner: 'CS Enzo', topic: 'Futures Trading', language: 'Chinese', platform: 'mobile' },
  { id: 2, title: 'Loan repayment', owner: 'CS VERA', topic: 'LOAN', language: 'English', platform: 'web' },
  { id: 3, title: 'Archived guide', owner: 'CS Gorkem T', topic: 'General', language: 'English', platform: 'mobile', archivedAt: '2026-09-12' },
];

test('replacement filtering searches every identifying field and excludes archived records', () => {
  for (const query of ['funding', 'enzo', 'futures', 'chinese', 'mobile']) {
    assert.deepEqual(filterStudioItems(records, { query }).map((item) => item.id), [1]);
  }
  assert.deepEqual(filterStudioItems(records, { query: 'archived' }), []);
});

test('studio filtering supports platform and explicit archive mode', () => {
  assert.deepEqual(filterStudioItems(records, { platform: 'web' }).map((item) => item.id), [2]);
  assert.deepEqual(filterStudioItems(records, { archiveMode: true }).map((item) => item.id), [3]);
});

test('studio count labels match the active collection', () => {
  assert.equal(studioCountLabel(2, false), '2 published guides');
  assert.equal(studioCountLabel(1, true), '1 archived guide');
});
```

- [ ] Run `node --test test/content-studio.test.js`; expect module-not-found failure.
- [ ] Implement `src/domain/contentStudio.js`:

```js
import { normalizePlatform, visibleCatalog } from './catalog.js';

const searchableFields = ['title', 'text', 'text_tr', 'owner', 'topic', 'language', 'platform'];

export function filterStudioItems(items, { query = '', platform = 'all', archiveMode = false } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  const source = archiveMode ? items.filter((item) => item.archivedAt) : visibleCatalog(items);
  return source.filter((item) => {
    const matchesQuery = !normalizedQuery || searchableFields.some((field) => String(item[field] || '').toLowerCase().includes(normalizedQuery));
    return matchesQuery && (platform === 'all' || normalizePlatform(item.platform) === platform);
  });
}

export function studioCountLabel(count, archiveMode = false) {
  const noun = count === 1 ? 'guide' : 'guides';
  return `${count} ${archiveMode ? 'archived' : 'published'} ${noun}`;
}
```

- [ ] Run `node --test test/content-studio.test.js`; expect 3 passing tests.
- [ ] Commit with `git commit -m "test: define existing screenshot selection behavior"`.

## Task 2 — Searchable existing screenshot picker

**Files:**

- Create: `src/components/admin/ExistingScreenshotPicker.jsx`
- Modify: `src/index.css`
- Modify: `test/runtime-qa.test.js`

- [ ] Add a failing runtime wiring test that reads the picker source and asserts `Choose a screenshot to replace`, `filterStudioItems`, the five metadata fields, and an accessible `Select .* to replace` label.
- [ ] Run `npm test -- --test-name-pattern="existing screenshot picker"`; expect one failure because the component is absent.
- [ ] Create `ExistingScreenshotPicker` with this complete structure:

```jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { filterStudioItems } from '../../domain/contentStudio';
import { normalizePlatform, ownerColorStyle, ownerInitials } from '../../domain/catalog';
import { AppIcon } from '../AppIcon';

const imageUrl = (value) => /^(https?:|data:)/.test(value || '') ? value : `${import.meta.env.BASE_URL}${value || ''}`;

export function ExistingScreenshotPicker({ items, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('all');
  const searchRef = useRef(null);
  const results = useMemo(() => filterStudioItems(items, { query, platform }), [items, platform, query]);

  useEffect(() => {
    searchRef.current?.focus();
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return <div className="modal-overlay replace-picker-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="replace-picker" role="dialog" aria-modal="true" aria-labelledby="replace-picker-title">
      <header className="replace-picker-header"><div><span className="eyebrow">Replace existing</span><h2 id="replace-picker-title">Choose a screenshot to replace</h2><p>Select the published record first so its history, analytics, and ownership stay connected.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close screenshot picker"><AppIcon name="X" /></button></header>
      <div className="replace-picker-controls"><label className="studio-search"><AppIcon name="Search" size={16} /><input ref={searchRef} aria-label="Search existing screenshots" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, owner, topic, language or platform…" /></label><div className="platform-switch studio-platforms" aria-label="Filter replacement candidates by platform">{['all', 'mobile', 'web'].map((value) => <button type="button" key={value} className={platform === value ? 'platform-button active' : 'platform-button'} onClick={() => setPlatform(value)}>{value === 'all' ? 'All' : value}</button>)}</div></div>
      <div className="replace-picker-summary"><strong>{results.length}</strong> published screenshots</div>
      <div className="replace-picker-results">{results.map((item) => <button type="button" className="replace-picker-item" key={item.id} onClick={() => onSelect(item)} aria-label={`Select ${item.title} to replace`}><img src={imageUrl(item.image)} alt="" /><span className="replace-picker-item-copy"><small>{item.topic} · {item.language} · {normalizePlatform(item.platform)}</small><strong>{item.title}</strong><span><i style={ownerColorStyle(item.owner)}>{ownerInitials(item.owner)}</i>{item.owner}</span></span><AppIcon name="ChevronRight" size={17} /></button>)}</div>
      {!results.length && <div className="studio-empty"><AppIcon name="SearchX" size={28} /><h3>No published screenshots match</h3><p>Try a title, owner, topic, language, or another platform.</p></div>}
    </section>
  </div>;
}
```

- [ ] Add these concrete style rules, plus a mobile override that changes the result grid to one column:

```css
.replace-picker-overlay { z-index: 360; padding: 24px; }
.replace-picker { width: min(980px, 100%); max-height: calc(100vh - 48px); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--line-2); border-radius: 16px; background: var(--bg-panel); box-shadow: var(--shadow-3); }
.replace-picker-header { display: flex; justify-content: space-between; gap: 18px; padding: 20px; border-bottom: 1px solid var(--line-1); }
.replace-picker-header h2 { margin: 5px 0; font-size: 22px; }
.replace-picker-header p { margin: 0; color: var(--text-3); }
.replace-picker-controls { display: flex; gap: 9px; padding: 14px 20px; background: var(--bg-raised); }
.replace-picker-summary { padding: 0 20px 10px; color: var(--text-3); font-size: 10px; background: var(--bg-raised); }
.replace-picker-results { min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 9px; padding: 16px 20px 22px; overflow-y: auto; }
.replace-picker-item { min-width: 0; display: grid; grid-template-columns: 108px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 8px; border: 1px solid var(--line-1); border-radius: 10px; background: var(--bg-panel); color: var(--text-1); text-align: left; cursor: pointer; }
.replace-picker-item:hover, .replace-picker-item:focus-visible { border-color: var(--accent); background: var(--accent-soft); outline: none; }
.replace-picker-item img { width: 108px; height: 72px; object-fit: contain; border-radius: 7px; background: var(--bg-inset); }
.replace-picker-item-copy { min-width: 0; display: grid; gap: 5px; }
.replace-picker-item-copy > small { overflow: hidden; color: var(--text-3); font-size: 8.5px; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
.replace-picker-item-copy > strong { overflow: hidden; font-size: 11px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.replace-picker-item-copy > span { display: flex; align-items: center; gap: 6px; color: var(--text-3); font-size: 9px; }
.replace-picker-item-copy i { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; background: hsl(var(--owner-hue) 48% 90%); color: hsl(var(--owner-hue) 40% 32%); font-size: 7px; font-style: normal; font-weight: 750; }
```
- [ ] Run the targeted test; expect it to pass.
- [ ] Commit with `git commit -m "feat: add existing screenshot picker"`.

## Task 3 — Wire explicit create and replace flows

**Files:**

- Modify: `src/pages/AdminPage.jsx`
- Modify: `src/components/admin/ContentList.jsx`
- Modify: `src/components/admin/ContentEditor.jsx`
- Modify: `src/components/admin/ImageReplaceField.jsx`
- Modify: `src/index.css`
- Modify: `test/runtime-qa.test.js`

- [ ] Add a failing runtime test asserting:

```js
assert.match(page, /ExistingScreenshotPicker/);
assert.match(list, /Replace existing/);
assert.match(list, /Create new/);
assert.match(editor, /Choose existing/);
assert.match(editor, /Updating something already published/);
assert.match(imageField, /currentImage\s*\?/);
assert.match(imageField, /studio-image-previews is-create/);
assert.match(list, /studioCountLabel/);
```

- [ ] Run the targeted test; expect failure on missing wiring and labels.
- [ ] In `AdminPage`, import the picker and replace the editor state handlers with:

```jsx
const [pickerOpen, setPickerOpen] = useState(false);
const openExisting = (item) => { setEditingItem(item); setPickerOpen(false); setEditorOpen(true); };
const openCreate = () => { setEditingItem(null); setPickerOpen(false); setEditorOpen(true); };
const openReplace = () => { setEditorOpen(false); setEditingItem(null); setPickerOpen(true); };
```

Render the three surfaces with:

```jsx
<ContentList items={items} onEdit={openExisting} onCreate={openCreate} onReplace={openReplace} onRefresh={refresh} loading={loading} canRecover={auth.isOwner} />
{pickerOpen && <ExistingScreenshotPicker items={items} onSelect={openExisting} onClose={() => setPickerOpen(false)} />}
{editorOpen && <ContentEditor item={editingItem} onChooseExisting={openReplace} onClose={() => setEditorOpen(false)} onPublished={published} />}
```

- [ ] In `ContentList`, import `filterStudioItems` and `studioCountLabel`, compute `filtered` by calling `filterStudioItems(items, { query, platform, archiveMode: showArchived })`, and render these exact toolbar actions:

```jsx
<div className="studio-create-actions">
  <button type="button" className="button button-quiet" onClick={onReplace}><AppIcon name="RefreshCw" size={16} /> Replace existing</button>
  <button type="button" className="button button-primary" onClick={onCreate}><AppIcon name="Plus" size={16} /> Create new</button>
</div>
```

Use `{studioCountLabel(filtered.length, showArchived)}` in the summary, `Replace / edit` on published cards, `Recover` on archived cards, and `No matching archived screenshots` when archive mode is active.

- [ ] In `ContentEditor`, accept `onChooseExisting`, define `isExisting = Boolean(item)`, and add:

```jsx
const chooseExisting = () => {
  if (dirty && !window.confirm('Discard this new guide draft and choose an existing screenshot?')) return;
  onChooseExisting();
};
```

For create mode, render this banner between the header and editor body:

```jsx
{!isExisting && <div className="editor-existing-switch"><span><AppIcon name="RefreshCw" size={17} /><span><strong>Updating something already published?</strong><small>Choose the existing screenshot first so its history and ownership stay connected.</small></span></span><button type="button" className="button button-quiet" onClick={chooseExisting}>Choose existing</button></div>}
```

Use `Replace image or edit guide` / `Create screenshot guide` headings, `Compare the published image with your replacement before publishing.` / `Upload the image for this new catalog entry.` helper copy, and `Publish changes` / `Publish new screenshot` primary labels.

- [ ] In `ImageReplaceField`, replace the preview block with:

```jsx
<div className={`studio-image-previews ${currentImage ? '' : 'is-create'}`}>
  {currentImage && <figure><figcaption>Current</figcaption><img src={imageUrl(currentImage)} alt="Current screenshot" /></figure>}
  <figure className={preview ? 'has-new-image' : ''}><figcaption>{currentImage ? 'Replacement' : 'New image'}</figcaption>{preview ? <img src={preview} alt={currentImage ? 'Replacement screenshot preview' : 'New screenshot preview'} /> : <div className="image-placeholder"><AppIcon name="ImagePlus" /><span>{currentImage ? 'Choose a replacement to compare' : 'Choose a file to preview'}</span></div>}</figure>
</div>
```

Set the upload label to `Choose replacement image` for existing records and `Choose screenshot` for new records.

- [ ] Add these styles and include `.replace-picker-results { grid-template-columns: 1fr; }` in the existing mobile media query:

```css
.studio-create-actions { display: flex; gap: 7px; }
.studio-edit-reveal { opacity: .82; transform: none; }
.studio-image-previews.is-create { grid-template-columns: 1fr; }
.editor-existing-switch { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 18px; border-bottom: 1px solid var(--line-1); background: var(--accent-soft); }
.editor-existing-switch > span { display: flex; align-items: center; gap: 9px; color: var(--accent); }
.editor-existing-switch > span > span { display: grid; gap: 2px; }
.editor-existing-switch strong { color: var(--text-1); font-size: 10.5px; }
.editor-existing-switch small { color: var(--text-3); font-size: 9px; }
```
- [ ] Run the targeted test and `node --test test/content-studio.test.js`; expect all passing.
- [ ] Commit with `git commit -m "fix: make screenshot replacement discoverable"`.

## Task 4 — Documentation and end-to-end verification

**Files:**

- Modify: `README.md`
- Modify: `.github/assets/content-studio.png`
- Modify: `.github/assets/content-editor.png`

- [ ] Update README Content Studio instructions to begin with `Replace existing`, describe the searchable selector, and distinguish it from `Create new`.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, `npm test --prefix worker`, and `npm run typecheck --prefix worker`; expect all commands to succeed.
- [ ] Start or reuse the local Vite app and verify: selector search, selection into a prefilled editor, current/replacement preview, create-mode single preview, wrong-entry recovery, and mobile layout.
- [ ] Capture updated Content Studio and replacement editor screenshots and replace the two README assets.
- [ ] Run `git diff --check` and verify the worktree is clean except intended files.
- [ ] Commit with `git commit -m "docs: update replacement workflow guide"`.
- [ ] Request code review with the base and head SHAs, resolve all blocking findings, rerun fresh verification, then integrate and deploy only after review is clean.
