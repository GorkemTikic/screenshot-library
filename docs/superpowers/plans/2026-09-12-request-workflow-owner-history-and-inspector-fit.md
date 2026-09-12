# Request Workflow, Owner History, and Inspector Fit — Implementation Plan

**Goal:** Make screenshot requests a concurrent, centrally shared workflow; preserve time-bounded owner credit through image replacements; and guarantee that the inspector shows every image in full.

**Architecture:** The independent Screenshot Library Worker owns live request state in D1 and serializes request mutations through a `RequestWriter` Durable Object. Every accepted mutation regenerates `src/data/requests.json` in GitHub; the bundled snapshot is a read-only frontend fallback. Catalog publishing remains in `CatalogWriter`, but ownership fields become server-owned and image replacement is the only mutation that opens a new owner-history interval.

**Tech stack:** React 19/Vite, Node test runner, TypeScript Cloudflare Worker, D1, Durable Objects, Vitest, Google Apps Script, Playwright browser QA.

---

## Task 1: Request contracts, repository fallback, and D1 schema

**Files:**
- Create: `src/data/requests.json`
- Create: `src/domain/requests.js`
- Create: `test/requests.test.js`
- Create: `worker/src/requests.ts`
- Create: `worker/test/requests.test.ts`
- Create: `worker/migrations/0002_request_workflow.sql`
- Modify: `worker/src/types.ts`
- Modify: `worker/wrangler.toml`
- Modify: `vite.config.js`

- [ ] Write failing frontend domain tests for canonical status normalization, filters, counters, terminal-state validation, and preservation of imported request fields.
- [ ] Implement the shared frontend contract:

```js
export const REQUEST_STATUSES = ['new', 'in_progress', 'done', 'already_exists', 'cannot_be_done'];

export function validateRequestResolution(request) {
  if (['done', 'already_exists'].includes(request.status) && !request.linkedRecordId) return 'Select a published screenshot.';
  if (request.status === 'cannot_be_done' && String(request.resolutionNote || '').trim().length < 10) return 'Add a resolution note of at least 10 characters.';
  return '';
}
```

- [ ] Run `npm test -- --test-name-pattern=request` and confirm RED, then GREEN.
- [ ] Write failing Worker tests for input cleaning, deterministic Sheet source keys, terminal validation, row serialization, and stale-version rejection.
- [ ] Implement `normalizeRequestInput`, `normalizeSheetRow`, `sourceKeyForSheetRow`, `validateRequestUpdate`, `requestRowToJson`, and `requestSnapshot` in `worker/src/requests.ts`.
- [ ] Add D1 tables `workflow_requests`, `request_events`, and `request_operations`, including unique `(source, source_key)`, immutable event history, nullable contributor foreign keys with `ON DELETE SET NULL`, version and sync-state indexes.
- [ ] Add `REQUEST_WRITER` and `REQUESTS_SOURCE_URL` to `Env`; add the v2 Durable Object migration without altering `CATALOG_WRITER`.
- [ ] Make Vite serve/copy both `data.json` and `requests.json` with no-store development responses.
- [ ] Run `npm --prefix worker test` and confirm the new tests pass.
- [ ] Commit: `feat: define shared request workflow contracts`

## Task 2: Serialized Request Worker and repository snapshot publishing

**Files:**
- Create: `worker/src/request-writer.ts`
- Create: `worker/test/request-writer.test.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/src/github.ts`
- Modify: `worker/src/contributors.ts`
- Modify: `worker/README.md`

- [ ] Write failing unit tests around a storage-independent request transition function proving version increment, immutable event payloads, idempotent replay, and `409 REQUEST_CONFLICT` payload shape.
- [ ] Add generic repository helpers that read the current branch/tree and create a `requestsTreeEntry`:

```ts
export function requestsTreeEntry(requests: unknown[]): TreeEntry {
  return { path: 'src/data/requests.json', mode: '100644', type: 'blob', content: `${JSON.stringify(requests, null, 2)}\n` };
}
```

- [ ] Implement `RequestWriter` with an in-instance promise queue. For create/update/import/resync it must: claim the idempotency key, read current state inside the queue, reject stale `baseVersion`, validate, execute request row + history event atomically with `DB.batch`, attempt one complete snapshot commit, mark `sync_state='synced'` on success or retain `pending` on GitHub failure, and store the replayable response.
- [ ] Add routes:

```text
POST /requests                 public create, rate-limited and field-whitelisted
GET  /requests                 authenticated contributor/owner read
GET  /request-assignees       authenticated safe active-name list
PATCH /requests/:id           authenticated workflow mutation
POST /requests/import         owner-only Sheet import
POST /requests/resync         owner-only snapshot retry
```

- [ ] Ensure public create cannot set status, assignee, resolution, linked screenshot, version, or sync state.
- [ ] Import `REQUESTS_SOURCE_URL` rows with a digest of normalized `submitted_at | device_hash | topic | language | platform | description`; use `INSERT OR IGNORE`, never overwrite rows that have workflow history, publish one snapshot after the batch, and return inserted/existing/invalid counts.
- [ ] Return each request with chronological `history`, contributor display names, version, and sync state.
- [ ] Document local migration and secret/variable setup without deploying anything.
- [ ] Run Worker tests and typecheck.
- [ ] Commit: `feat(worker): add serialized request workflow publishing`

## Task 3: Public request submission and contributor workflow UI

**Files:**
- Create: `src/components/requests/RequestWorkflow.jsx`
- Create: `test/request-api.test.js`
- Modify: `src/services/contentApi.js`
- Modify: `src/components/RequestScreenshotModal.jsx`
- Modify: `src/pages/AnalyticsPage.jsx`
- Modify: `src/index.css`

- [ ] Write failing API-client tests proving public create omits Authorization, authenticated reads/updates include the session, updates send `baseVersion` and idempotency, conflicts expose `latest`, and import/resync routes are owner actions.
- [ ] Add client methods:

```js
requests: () => request('/requests'),
requestAssignees: () => request('/request-assignees'),
createRequest: (input) => request('/requests', { method: 'POST', body: input, auth: false, idempotency: true }),
updateRequest: (id, input) => request(`/requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: input, idempotency: true }),
importRequests: () => request('/requests/import', { method: 'POST', body: {}, idempotency: true }),
resyncRequests: () => request('/requests/resync', { method: 'POST', body: {}, idempotency: true }),
```

- [ ] Replace Sheet-only public submission with `contentApi.createRequest`; display the Worker’s stable request ID as the follow-up reference and preserve the draft on failure.
- [ ] Build `RequestWorkflow` with status counters, search/status/topic/language/assignee filters, compact cards, detail drawer, catalog-linked screenshot picker, assignee selection, resolution note, chronological history, explicit idle/saving/saved/error/conflict/sync-pending states, refresh, owner-only import, and owner-only resync.
- [ ] On `409`, replace the base/live request with `error.latest` while leaving the editor’s chosen status, assignee, note and linked screenshot intact for deliberate retry.
- [ ] Change Analytics access from owner-only to authenticated. Owners see Overview/Requests/Survey; contributors land on Requests and render no owner-only tab controls.
- [ ] Keep Survey read-only.
- [ ] Add responsive editorial styling for counters, request list, drawer, status chips, history timeline, linked-guide picker, mobile stack, focus-visible and disabled states.
- [ ] Run frontend tests, lint, and build.
- [ ] Commit: `feat: add collaborative request operations workspace`

## Task 4: Ownership-history migration and server-enforced transfer

**Files:**
- Create: `scripts/migrate-owner-history.mjs`
- Create: `test/migrate-owner-history.test.js`
- Modify: `src/data/data.json`
- Modify: `worker/src/catalog.ts`
- Modify: `worker/src/publisher.ts`
- Modify: `worker/test/catalog.test.ts`
- Modify: `src/components/admin/ContentEditor.jsx`

- [ ] Write failing migration tests proving: Gorkem and Enzo start at `null`; Vera starts at each preserved `ownerSince`; the migration is idempotent; current owner/key compatibility fields are preserved; and all 110 records receive one open interval.
- [ ] Implement stable keys and interval construction:

```js
export const ownerKey = (name = '') => String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function initialOwnerHistory(item) {
  const from = /^CS (Gorkem T|Enzo)$/i.test(item.owner) ? null : item.ownerSince || null;
  return [{ ownerKey: ownerKey(item.owner), owner: item.owner, from, to: null, reason: 'initial-attribution', changedBy: 'migration' }];
}
```

- [ ] Run the mechanical migration against `src/data/data.json`; verify 110 records, 40 Gorkem, 36 Enzo, 34 Vera, one open interval per record, and no duplicate normalized-title groups.
- [ ] Write failing Worker tests proving create ignores spoofed owner fields, create opens ownership for the authenticated contributor, text-only update leaves ownership unchanged, image replacement closes the old interval and opens the contributor interval without overlap, same-owner replacement does not split the interval, and image-changing rollback follows the same rule.
- [ ] Remove `owner` and `ownerSince` from editable patch fields and the Content Studio form. Add server-only `ownerKey`, `ownerSince`, and `ownerHistory` creation.
- [ ] In `CatalogWriter`, call `transferImageOwnership(record, before, principal, now)` only after a genuine uploaded image is accepted or a rollback selects a different image path. Keep text-only audit attribution in `updatedBy` without changing owner.
- [ ] Preserve current ownership history during rollback instead of restoring stale historical owner fields from an old audit snapshot.
- [ ] Run migration and Worker tests.
- [ ] Commit: `feat: preserve ownership across screenshot revisions`

## Task 5: Interval-aware analytics and owner presentation

**Files:**
- Modify: `src/domain/analyticsEvents.js`
- Modify: `test/analytics-events.test.js`
- Modify: `apps-script/Code.gs`
- Modify: `apps-script/owner-analytics.gs`
- Modify: `test/apps-script-analytics.test.js`
- Modify: `src/domain/catalog.js`
- Modify: `test/catalog.test.js`
- Modify: `src/pages/OwnersPage.jsx`

- [ ] Write failing tests proving screenshot events contain `recordId` and `ownerKey`, Apps Script persists `Record_ID` and `Owner_Key`, and owner aggregation distinguishes current guides from lifetime contributed guides.
- [ ] Extend `screenshotEvent` with stable identifiers and extend `DB_Logs` headers/rows without changing the first eight legacy columns.
- [ ] Rebuild Apps Script owner attribution around two indexes: unique `recordId` first, normalized exact-title fallback second. Mark duplicate normalized titles ambiguous and skip them rather than assigning credit.
- [ ] Resolve the owner-history interval containing the event timestamp using inclusive `from` and exclusive `to`. Missing timestamps are countable only for an all-time open interval.
- [ ] Seed current-owned and lifetime-contributed counts from the catalog, then return views/copies/total/agents credited to intervals plus a skipped-collision count.
- [ ] Update Owner sheet/detail headers and the Owners page to show Current, Lifetime, Views, Copies, last contribution, and a collision-warning note when applicable.
- [ ] Run frontend tests.
- [ ] Commit: `feat: attribute analytics through owner history`

## Task 6: Inspector full-image fit regression

**Files:**
- Modify: `src/index.css`
- Modify: `test/runtime-qa.test.js`

- [ ] Add a failing regression test requiring the desktop media grid item to declare `min-height: 0` and contained overflow, and the inspector image to fill the available box with `width: 100%`, `height: 100%`, and `object-fit: contain`.
- [ ] Apply the minimum production rules:

```css
.inspector-media { min-width: 0; min-height: 0; overflow: hidden; }
.inspector-media img { width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: contain; }
```

- [ ] Run the regression test and frontend suite.
- [ ] Use Playwright at 1440×1000 on `How To Change Order Size/Unit Preference to Initial Margin - EN.jpeg`; assert the image rectangle is contained by `.inspector-media` on all four edges.
- [ ] Repeat at 390×844 and with a wide screenshot; verify no horizontal overflow and independent response-panel scrolling.
- [ ] Commit: `fix: keep complete screenshots visible in inspector`

## Task 7: End-to-end local verification and handoff

**Files:**
- Modify if required by findings: only files already listed above

- [ ] Apply `0002_request_workflow.sql` to the local D1 database only and restart/refresh the local Worker without deploying.
- [ ] Exercise local API: public create, contributor read, owner update, stale-version conflict, terminal validation, import dry path, and concurrent updates to distinct request IDs.
- [ ] Run fresh gates:

```powershell
npm test
npm run lint
npm run build
npm --prefix worker test
npm --prefix worker run typecheck
npx wrangler deploy --dry-run --config worker/wrangler.toml
```

- [ ] Run browser QA for owner tabs, contributor Requests-only access, status update/history, request submission, owner metrics, desktop/mobile inspector fit, and console errors.
- [ ] Review the complete diff against the approved spec; confirm no GitHub credentials entered the frontend and no deployment/push occurred.
- [ ] Commit any verification-only fixes in focused commits, then keep the branch/worktree intact for user review.

