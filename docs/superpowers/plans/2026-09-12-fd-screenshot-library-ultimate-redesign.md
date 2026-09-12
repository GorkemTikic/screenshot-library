# FD Screenshot Library Ultimate Redesign — Implementation Plan

**Goal:** Deliver the approved clean-editorial redesign, secure contributor Content Studio, independent Cloudflare publishing API, owner migration, and concurrency-safe direct publishing without pushing or deploying the repository.

**Architecture:** The React/Vite site keeps its current read-only public data and Google Apps Script integrations. A new isolated `worker/` Cloudflare project authenticates contributors, serializes GitHub writes through one Durable Object, stores access/audit state in D1, and relies on the existing `main` push GitHub Pages workflow for publication.

**Tech stack:** React 19, React Router 7, Vite 7, Fuse.js, Framer Motion, Lucide React, Recharts, Node test runner for frontend domain tests, Cloudflare Workers TypeScript, D1, Durable Objects, Vitest.

> Execution is local only. Each checkpoint may create a local commit, but no `git push`, `npm run deploy`, or Cloudflare deploy command may run.

## Task 1 — Establish test commands and catalog domain helpers

**Files:**

- Modify: `package.json`
- Create: `src/domain/catalog.js`
- Create: `test/catalog.test.js`

- [ ] Add `"test": "node --test"` to root scripts.
- [ ] Write tests first for legacy platform normalization, public-item filtering, topic metadata, deterministic owner initials, and dirty-field patch generation.
- [ ] Run `npm test`; expect failures because `src/domain/catalog.js` does not exist.
- [ ] Implement the module with these exports:

```js
export const TOPIC_META = {
  'Futures Trading': { icon: 'CandlestickChart', tone: 'amber' },
  'Margin Trading': { icon: 'Scale', tone: 'blue' },
  General: { icon: 'LayoutGrid', tone: 'slate' },
  LOAN: { icon: 'HandCoins', tone: 'green' },
  'Copy Trading': { icon: 'CopyCheck', tone: 'violet' },
  'Event Contract': { icon: 'TicketCheck', tone: 'rose' },
  BOTS: { icon: 'Bot', tone: 'cyan' },
};

export const normalizePlatform = (value) => value === 'web' ? 'web' : 'mobile';
export const visibleCatalog = (items) => items.filter((item) => !item.archivedAt);
export const ownerInitials = (name = '') => name.replace(/^CS\s+/i, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '—';
export const buildPatch = (base, draft, fields) => Object.fromEntries(fields.filter((field) => JSON.stringify(base?.[field]) !== JSON.stringify(draft?.[field])).map((field) => [field, draft[field]]));
export const recordVersion = (item) => item?.version || item?.updatedAt || String(item?.id || '');
```

- [ ] Run `npm test`; expect all catalog tests to pass.
- [ ] Run `git diff --check`.
- [ ] Local commit: `git add package.json src/domain/catalog.js test/catalog.test.js && git commit -m "test: add catalog domain contracts"`.

## Task 2 — Migrate owner attribution safely

**Files:**

- Create: `scripts/migrate-owners.mjs`
- Create: `test/migrate-owners.test.js`
- Modify through script: `src/data/data.json`

- [ ] Write a fixture test proving existing owners remain unchanged and blank owners map as follows: English/Arabic/Russian/Vietnamese → `CS Gorkem T`; Chinese → `CS Enzo`.
- [ ] Assert `ownerSince` comes from a valid numeric epoch `id` before other fallbacks.
- [ ] Run `npm test`; expect the migration test to fail.
- [ ] Implement and export:

```js
export const OWNER_BY_LANGUAGE = {
  English: 'CS Gorkem T', Arabic: 'CS Gorkem T', Russian: 'CS Gorkem T',
  Vietnamese: 'CS Gorkem T', Chinese: 'CS Enzo',
};

export function migrateRecord(item, now = new Date()) {
  if (String(item.owner || '').trim()) return item;
  const owner = OWNER_BY_LANGUAGE[item.language];
  if (!owner) return item;
  const fromId = Number.isFinite(Number(item.id)) ? new Date(Number(item.id)) : null;
  const fromUpdated = item.updatedAt ? new Date(item.updatedAt) : null;
  const date = fromId && !Number.isNaN(fromId.getTime()) ? fromId : fromUpdated && !Number.isNaN(fromUpdated.getTime()) ? fromUpdated : now;
  return { ...item, owner, ownerSince: date.toISOString() };
}
```

- [ ] Add CLI logic that reads and rewrites `src/data/data.json` with a trailing newline and prints assignment totals.
- [ ] Run `node scripts/migrate-owners.mjs`; expect all 110 records preserved, CS VERA preserved, Chinese blanks assigned to CS Enzo, and other specified blanks assigned to CS Gorkem T.
- [ ] Run `npm test` and `git diff --check`.
- [ ] Local commit: `git add scripts/migrate-owners.mjs test/migrate-owners.test.js src/data/data.json && git commit -m "data: assign screenshot owners"`.

## Task 3 — Replace the global visual system and shell

**Files:**

- Modify: `index.html`
- Modify: `src/contexts/ThemeContext.jsx`
- Modify: `src/components/Layout.jsx`
- Modify: `src/components/MarketTicker.jsx`
- Create: `src/components/AppIcon.jsx`
- Replace: `src/index.css`

- [ ] Update the document title, theme-color metadata, favicon base path, and font preconnects.
- [ ] Move theme state to `<html data-theme>` while reading the existing `fd_theme` preference; default to light.
- [ ] Build a two-row shell with FD mark, Library/Analytics/Owners navigation, Request, Feedback, Content Studio, theme control, responsive overflow, and the existing modal providers.
- [ ] Keep market data behavior but remove fabricated price fallback. Network failure renders `Market data unavailable` and retries on the existing interval.
- [ ] Create `AppIcon` as a single Lucide mapping boundary used by shell, categories, analytics, owners, and Content Studio.
- [ ] Replace CSS with semantic light/dark tokens, typography, base controls, focus rings, sheets, dialogs, toast, skeleton, shell, responsive breakpoints, and reduced-motion rules.
- [ ] Run `npm run build`; expect Vite to complete with no unresolved imports.
- [ ] Run `npm test` and `git diff --check`.
- [ ] Local commit: `git add index.html src/contexts/ThemeContext.jsx src/components/Layout.jsx src/components/MarketTicker.jsx src/components/AppIcon.jsx src/index.css && git commit -m "feat: introduce FD editorial application shell"`.

## Task 4 — Rebuild Library search, category rail, cards, and inspector

**Files:**

- Modify: `src/pages/HomePage.jsx`
- Modify: `src/components/ScreenshotGallery.jsx`
- Modify: `src/components/ScreenshotCard.jsx`
- Modify: `src/components/Lightbox.jsx`
- Create: `src/hooks/useKeyboardShortcut.js`
- Create: `src/components/Toast.jsx`
- Create: `test/library-filter.test.js`
- Modify: `src/domain/catalog.js`

- [ ] Test a new `filterCatalog(items, filters)` helper for search-result intersection, platform defaults, topic, language, favorites, archived records, and newest-first sorting.
- [ ] Run `npm test`; expect the new filter tests to fail.
- [ ] Implement `filterCatalog` as a pure helper receiving `matchedIds` rather than constructing Fuse internally.
- [ ] Create the editorial intro with real total/latest data and the command search supporting `/`, Ctrl/Command+K, Escape, ARIA live count, and removable filter chips.
- [ ] Render the seven category controls from `TOPIC_META`, each with a live count.
- [ ] Rebuild cards with stable media aspect ratio, topic icon, platform/language metadata, deterministic owner avatar, EN/TR segment, primary copy morph, toast, Favorite, and Inspect.
- [ ] Convert Lightbox to a focus-managed inspector with previous/next navigation over filtered items, metadata, text preview, language segment, and copy.
- [ ] Preserve existing analytics event names and iframe clipboard fallback.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Local commit: `git add src/pages/HomePage.jsx src/components/ScreenshotGallery.jsx src/components/ScreenshotCard.jsx src/components/Lightbox.jsx src/hooks/useKeyboardShortcut.js src/components/Toast.jsx src/domain/catalog.js test/library-filter.test.js && git commit -m "feat: rebuild screenshot discovery experience"`.

## Task 5 — Redesign Screenshot Request and Feedback Survey

**Files:**

- Create: `src/domain/survey.js`
- Create: `test/survey.test.js`
- Modify: `src/components/RequestScreenshotModal.jsx`
- Modify: `src/components/SurveyModal.jsx`

- [ ] Write tests for three survey sections, per-section validation, full validation, draft serialization, and a reference generator matching `FDSL-YYYYMMDD-XXXX`.
- [ ] Run `npm test`; expect survey tests to fail.
- [ ] Implement pure survey helpers used by the UI.
- [ ] Convert Request into a side sheet with duplicate suggestions, clear field grouping, inline limits, request reference, accessible close/discard behavior, and existing Apps Script submission/rate limiting.
- [ ] Convert Survey into three steps with progress, Back/Next, per-step errors, local draft persistence under `fd_survey_draft_v1`, final review, submit protection, and existing ten-field payload.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Local commit: `git add src/domain/survey.js test/survey.test.js src/components/RequestScreenshotModal.jsx src/components/SurveyModal.jsx && git commit -m "feat: redesign request and survey flows"`.

## Task 6 — Create the independent Worker project and auth primitives

**Files:**

- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/wrangler.toml`
- Create: `worker/src/types.ts`
- Create: `worker/src/crypto.ts`
- Create: `worker/src/auth.ts`
- Create: `worker/src/http.ts`
- Create: `worker/src/index.ts`
- Create: `worker/migrations/0001_init.sql`
- Create: `worker/test/crypto.test.ts`

- [ ] Configure the Cloudflare project name `fd-screenshot-library-api`, D1 binding `DB`, Durable Object binding `CATALOG_WRITER`, compatibility date `2026-09-01`, and a new-class migration.
- [ ] Add D1 tables `contributors`, `sessions`, `audit_events`, and `idempotency_keys` with indexes for status, expiry, record, and contributor lookups.
- [ ] Test base64url, SHA-256, PBKDF2 access-code hashing, timing-safe comparison, code parsing, and HMAC session creation/verification.
- [ ] Run `npm --prefix worker test`; expect tests to fail before implementation.
- [ ] Implement codes in `fdsl_<contributor-id>_<32-byte-secret>` format, PBKDF2-SHA256 with 210,000 iterations, and HMAC-SHA256 session tokens with 8-hour expiry and `code_version` claim.
- [ ] Implement exact-origin CORS through `ALLOWED_ORIGINS`; reject wildcard privileged origins.
- [ ] Implement `/auth/login`, `/auth/logout`, and `/auth/me`, including Owner bootstrap via `OWNER_BOOTSTRAP_CODE` and secrets stored only in Worker bindings.
- [ ] Run Worker tests and `npm --prefix worker run typecheck`.
- [ ] Local commit: `git add worker && git commit -m "feat(worker): add isolated contributor authentication"`.

## Task 7 — Implement concurrency-safe GitHub publishing

**Files:**

- Create: `worker/src/catalog.ts`
- Create: `worker/src/github.ts`
- Create: `worker/src/publisher.ts`
- Create: `worker/test/catalog.test.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/src/types.ts`

- [ ] Test payload sanitation, allowed content fields, MIME signature validation, record hashing, disjoint patch merge, same-field conflict response, idempotency behavior, archive, and owner rollback authorization.
- [ ] Run Worker tests; expect catalog tests to fail.
- [ ] Implement `detectConflicts(base, latest, patch)` with conflict keys defined by fields present in `patch` whose latest value differs from base.
- [ ] Implement a single `CatalogWriter` Durable Object that receives authenticated mutation envelopes, retrieves current GitHub `main`, reads `src/data/data.json`, merges by immutable numeric `id`, creates optional image blobs, deletes unreferenced prior image paths from the new tree, writes data and image changes in one non-forced commit, and retries a moved ref up to three times.
- [ ] Require an idempotency key for every mutation and persist successful response JSON in D1.
- [ ] Record audit before/after JSON, changed fields, commit SHA, contributor, record ID, request ID, and timestamp.
- [ ] Route create, patch, replace-image, resolve-conflict, archive, and rollback mutations through the Durable Object.
- [ ] Run Worker tests and typecheck.
- [ ] Local commit: `git add worker && git commit -m "feat(worker): serialize atomic catalog publishing"`.

## Task 8 — Add frontend authentication and publishing client

**Files:**

- Create: `src/services/contentApi.js`
- Create: `src/contexts/AuthContext.jsx`
- Create: `src/components/AccessGate.jsx`
- Create: `src/components/ConflictResolver.jsx`
- Create: `test/content-api.test.js`
- Modify: `src/App.jsx`
- Modify: `src/components/Layout.jsx`
- Modify: `.env.example`

- [ ] Test URL construction, session header generation, mutation idempotency header, server-error normalization, and 409 conflict normalization using mocked fetch.
- [ ] Run root tests; expect failures.
- [ ] Implement the client around `VITE_CONTENT_API_URL`, storing only the session token in `sessionStorage` key `fdsl_session_v1`.
- [ ] Implement AuthProvider login/logout/me refresh, owner/contributor helpers, expired-session cleanup, and safe API-unavailable state.
- [ ] Wrap routes in AuthProvider and replace separate hardcoded Admin/Analytics password screens with AccessGate.
- [ ] Render ConflictResolver with base/latest/mine values and explicit per-field choices.
- [ ] Run root tests, lint, and build.
- [ ] Local commit: `git add src/services/contentApi.js src/contexts/AuthContext.jsx src/components/AccessGate.jsx src/components/ConflictResolver.jsx test/content-api.test.js src/App.jsx src/components/Layout.jsx .env.example && git commit -m "feat: add contributor session and publish client"`.

## Task 9 — Replace Admin with Content Studio and Access Management

**Files:**

- Replace: `src/pages/AdminPage.jsx`
- Create: `src/components/admin/ContentList.jsx`
- Create: `src/components/admin/ContentEditor.jsx`
- Create: `src/components/admin/ImageReplaceField.jsx`
- Create: `src/components/admin/AccessManagement.jsx`
- Create: `src/components/admin/AuditLog.jsx`
- Create: `src/hooks/useUnsavedChanges.js`
- Modify: `src/contexts/DataContext.jsx`
- Delete: `src/services/github.js`

- [ ] Remove all imports and storage references to `githubService`, `gh_token`, and `admin123`.
- [ ] Extend DataContext with `replaceItems`, `upsertCanonicalItem`, visible public items, and Content Studio access to archived records.
- [ ] Build list filters for search, topic, language, platform, owner, freshness, and archived state.
- [ ] Build the editor with dirty-field tracking, EN/TR tabs, rendered text preview, topic/language creation, owner defaults, current/new image comparison, JPEG/PNG/WebP and 12 MB client checks, publish progress, canonical response update, and no reload.
- [ ] Add contributor code create/rotate/enable/disable UI gated by owner role; show a new full access code exactly once in a copy panel.
- [ ] Add owner-only audit list, archive, and rollback controls.
- [ ] Use ConflictResolver for HTTP 409 and preserve the draft until resolved.
- [ ] Run tests, lint, build, and search for forbidden legacy secrets with `rg -n "admin123|gh_token|githubService" src` expecting no matches.
- [ ] Local commit: `git add src/pages/AdminPage.jsx src/components/admin src/hooks/useUnsavedChanges.js src/contexts/DataContext.jsx src/services/github.js && git commit -m "feat: replace admin with contributor content studio"`.

## Task 10 — Redesign Analytics and Owners

**Files:**

- Modify: `src/pages/AnalyticsPage.jsx`
- Create: `src/pages/OwnersPage.jsx`
- Create: `src/components/analytics/MetricCard.jsx`
- Create: `src/components/analytics/DataTable.jsx`
- Create: `src/components/analytics/DetailSheet.jsx`
- Modify: `src/App.jsx`

- [ ] Gate Analytics and Owners through Owner role.
- [ ] Extract repeated loading, error, empty, filtering, table, and detail-sheet presentation.
- [ ] Preserve Overview, Requests, Surveys, and Owners data sources and calculations.
- [ ] Use the FD orange/neutral chart palette with theme-aware axes and tooltips.
- [ ] Add row detail sheets for Request and Survey data.
- [ ] Build Owners route with deterministic avatars, contribution count from catalog, usage-since-ownership data, latest contribution, top screenshot, and owner-filtered gallery/detail sheet.
- [ ] Run tests, lint, and build.
- [ ] Local commit: `git add src/pages/AnalyticsPage.jsx src/pages/OwnersPage.jsx src/components/analytics src/App.jsx && git commit -m "feat: rebuild analytics and owner insights"`.

## Task 11 — Integration verification, visual QA, and documentation

**Files:**

- Modify: `README.md`
- Modify: `DEPLOYMENT.md`
- Create: `worker/README.md`
- Create: `docs/CONTENT_STUDIO_GUIDE.md`

- [ ] Document local two-process development, API URL configuration, D1 migration, Owner bootstrap, secrets, contributor lifecycle, GitHub token permissions, CORS origins, and separate Cloudflare project requirement.
- [ ] Document that no deployment or push has been performed.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, `npm --prefix worker test`, and `npm --prefix worker run typecheck`; all must exit 0.
- [ ] Start the local Vite preview and Worker dev process.
- [ ] Inspect 1440×900, 1024×768, and 390×844 in light and dark themes.
- [ ] Verify Library search/filter/copy/inspector, Request, three-step Survey, contributor login, add, edit, image replace, owner access, Analytics, Owners, error states, and reduced motion.
- [ ] Run a five-request concurrency integration test against the local Worker and confirm every distinct-record patch remains in canonical output; run same-field and disjoint-field tests on one record.
- [ ] Run `git status --short`, `git diff --check`, and `git log --oneline --max-count=12`.
- [ ] Local commit: `git add README.md DEPLOYMENT.md worker/README.md docs/CONTENT_STUDIO_GUIDE.md && git commit -m "docs: add content studio deployment guide"`.
- [ ] Do not push, deploy Pages, deploy the Worker, or create external resources.

## Requirement coverage check

- Clean Editorial FD family: Tasks 3–5 and 10.
- Search customization, category icons, cards, EN/TR, copy, owner icons, animation: Task 4.
- Screenshot Request and Survey: Task 5.
- Owner assignments and Owners page: Tasks 2 and 10.
- Admin redesign, add/update/image replacement/text editing: Task 9.
- Personal codes and role management: Tasks 6, 8, and 9.
- Five-person concurrency and same-record conflicts: Task 7 and Task 11.
- Independent Worker project: Tasks 6, 7, and 11.
- No push before finalization: global execution rule and Task 11.
