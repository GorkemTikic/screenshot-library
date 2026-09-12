# FD Screenshot Library — Request Workflow, Owner History, and Inspector Fit

Date: 2026-09-12
Status: Approved product direction, ready for implementation review

## Goals

1. Turn screenshot requests into a shared, editable workflow instead of a read-only list.
2. Persist every request mutation centrally and mirror the canonical request snapshot into the repository so every deployed client converges on the same state.
3. Import existing Google Sheet request rows without duplication or lost history.
4. Preserve every screenshot owner’s historical contribution and usage credit across future image replacements.
5. Guarantee that every screenshot is fully visible inside the inspector, regardless of its aspect ratio.

Survey responses remain read-only and are explicitly outside this workflow.

## Request lifecycle

Canonical statuses:

- `new`
- `in_progress`
- `done`
- `already_exists`
- `cannot_be_done`

Transitions are not artificially restricted, because owners may need to reopen or correct a request. Every transition is appended to immutable history.

Validation:

- `done` requires `linkedRecordId` referencing a published screenshot.
- `already_exists` requires `linkedRecordId` referencing a published screenshot.
- `cannot_be_done` requires a non-empty `resolutionNote` of at least 10 characters.
- `in_progress` may have an assignee; `new` may remain unassigned.
- Description, topic, language, and platform imported from the original request are preserved.

## Request interface

The Analytics workspace keeps Overview, Requests, and Survey tabs.

- Owners can access all three tabs.
- Contributors can access the Requests workflow only.
- A contributor entering Analytics lands directly on Requests and cannot access owner-only Overview or Survey data.

Requests includes:

- compact status counters;
- search plus status, topic, language, and assignee filters;
- request cards showing age, status, assignee, and last editor;
- a detail drawer for status, assignee, resolution note, linked screenshot, and immutable history;
- explicit saving, pending, success, validation, and conflict states;
- refresh from the live Worker.

The linked screenshot picker searches the current catalog. Selecting `done` or `already_exists` cannot be saved until a screenshot is selected.

## Shared persistence architecture

The dedicated FD Screenshot Library Worker remains separate from FD Macro Generator.

### Live state

Cloudflare D1 is the operational request store. The frontend reads and mutates requests through authenticated Worker endpoints. Public request submission also goes to the Worker after server-side validation and rate limiting.

### Repository snapshot

After each accepted create or update, a dedicated `RequestWriter` Durable Object serializes the mutation, commits it to D1, regenerates the complete visible request snapshot, and writes `src/data/requests.json` to GitHub through the existing commit service. The GitHub commit triggers the existing site build, while connected clients can read the live D1 state immediately.

The frontend imports `src/data/requests.json` as its read-only fallback when the Worker cannot be reached. It never writes directly to GitHub and never receives a GitHub credential.

### Concurrency

Each request has an integer `version`. Updates include `baseVersion` and an idempotency key. `RequestWriter` processes updates serially:

1. Reject an already-used idempotency key by returning its stored result.
2. Read the current D1 row inside the queue.
3. Return `409 REQUEST_CONFLICT` if `baseVersion` is stale.
4. Validate terminal-state requirements.
5. Write the new row and request-history event in one D1 transaction/batch.
6. Regenerate and commit the repository snapshot.
7. Store and return the idempotent result.

The UI reloads the latest request on conflict and preserves the editor’s note/status so the contributor can deliberately retry.

### Repository failure handling

D1 is not rolled back when a GitHub snapshot commit fails. The request is marked `sync_pending`, the API returns the accepted live record with its sync state, and an owner-visible retry action republishes the snapshot. This avoids losing an accepted workflow update because GitHub is temporarily unavailable.

## D1 schema

`workflow_requests` fields:

- `id` — deterministic request identifier
- `source` — `worker` or `sheet_import`
- `source_key` — unique import key
- `created_at`
- `requester_hash`
- `topic`
- `requested_language`
- `requested_platform`
- `description`
- `context`
- `search_terms`
- `status`
- `assignee_contributor_id`
- `resolution_note`
- `linked_record_id`
- `version`
- `updated_by_contributor_id`
- `updated_at`
- `sync_state` — `synced` or `pending`

`request_events` fields:

- `id`
- `request_id`
- `actor_contributor_id`
- `action`
- `before_json`
- `after_json`
- `created_at`
- `request_idempotency_key`

Foreign keys use `ON DELETE SET NULL` for contributor references so disabling or removing access never destroys workflow history.

## Existing Sheet import

The owner-only `POST /requests/import` endpoint fetches the existing Apps Script `?getRequests=true` JSON endpoint configured as `REQUESTS_SOURCE_URL`.

For each row, `source_key` is a stable digest of normalized:

```text
submitted_at | device_hash | topic | language | platform | description
```

Upsert uses the unique `(source, source_key)` constraint. Running import repeatedly is safe and reports inserted, existing, and invalid counts. Imported rows start as `new`, unless a previously imported request already has workflow changes—in that case its current state is never overwritten.

After import, a single repository snapshot is published. Google Sheet remains historical input; all new requests use the Worker.

## Ownership history model

Current display fields remain for compatibility:

- `owner`
- `ownerKey`
- `ownerSince`

Each catalog record also contains:

```json
{
  "ownerHistory": [
    {
      "ownerKey": "cs-gorkem-t",
      "owner": "CS Gorkem T",
      "from": null,
      "to": null,
      "reason": "initial-attribution",
      "changedBy": "migration"
    }
  ]
}
```

Rules:

- Existing CS Gorkem T and CS Enzo records receive an open interval with `from: null`, so all matching historical `DB_Logs` usage is credited to them.
- Existing CS VERA records receive an open interval beginning at their preserved `ownerSince`; usage before that timestamp is not credited to Vera.
- Creating a screenshot sets the authenticated contributor as current owner and starts the first interval at publish time.
- Replacing the image closes the current interval at publish time and starts an interval for the authenticated contributor. If the contributor is already the current owner, the open interval remains unchanged.
- Text-only edits never alter ownership. The editor remains visible in the audit log.
- Archive, restore, and rollback preserve history. A rollback that changes the actual image follows the same image-replacement ownership rule.
- Owner transfers are server-enforced; the browser cannot forge owner fields.

`ownerKey` is a normalized stable key independent from display-name casing. Existing keys are `cs-gorkem-t`, `cs-enzo`, and `cs-vera`.

## Usage attribution and collision safety

New screenshot events include both `recordId` and `ownerKey`. Owner analytics resolves usage by `recordId` first and chooses the owner-history interval containing the event timestamp.

Historical `DB_Logs` rows lack `recordId`, so they use normalized exact-title fallback. Current catalog verification shows zero duplicate title groups. The analytics job nevertheless rejects ambiguous title matches instead of crediting the wrong owner and reports the skipped collision count.

Owner summaries distinguish:

- currently owned screenshots;
- lifetime contributed screenshots (any owner-history interval);
- views and copies credited during the owner’s intervals;
- latest contribution/update activity from the publishing audit trail.

This prevents a future image replacement from erasing Vera’s, Enzo’s, or Gorkem’s historical contribution.

## Screenshot inspector fit

The inspector opens in **Fit** behavior by default: the complete screenshot is centered inside the available media pane, keeps its original aspect ratio, and is never cropped. This applies to unusually tall, unusually wide, and multi-panel screenshots.

The current clipping is a layout defect, not a source-image problem. A reproduced 1,384 × 1,406 image caused the left grid pane to expand to 999 px inside an 850 px modal because the grid item retained its intrinsic automatic minimum height. The modal then hid the overflowing bottom portion.

Implementation behavior:

- The media grid item may shrink below its intrinsic image height and contains overflow within the modal.
- The image uses the full available media box with `object-fit: contain`; its rendered bounds must stay inside the media pane on both axes.
- The response/detail column continues to scroll independently, without changing the image pane height.
- On the mobile stacked layout, the full image remains visible inside the media section without horizontal overflow or viewport clipping.
- The existing **Open image** action remains the way to inspect the native-resolution asset separately; a new zoom control is not required for this fix.
- Opening the inspector continues to emit one meaningful screenshot-view analytics event. Layout changes must not duplicate that event.

## Security and audit

- Public create accepts only request fields and is server-rate-limited; it cannot set status, assignee, resolution, or sync state.
- Authenticated contributors can update workflow fields.
- Only owners can import Sheet history or force snapshot resync.
- Every mutation records actor, before/after state, timestamp, request ID, and idempotency key.
- GitHub credentials remain Worker-only secrets.

## Verification requirements

- Migration tests prove Gorkem/Enzo begin all-time and Vera begins at preserved `ownerSince`.
- Interval tests prove image replacement closes/opens ownership without overlap and text edits preserve ownership.
- Attribution tests prove record-ID priority, exact-title historical fallback, interval boundaries, and ambiguous-title rejection.
- Request tests cover validation, deterministic import IDs, idempotent re-import, legal updates, conflict responses, history, snapshot generation, and pending-sync recovery.
- Browser QA covers contributor Requests-only access, all request statuses, required terminal fields, conflict feedback, owner counters, and mobile layout.
- Inspector tests cover tall and wide fixtures, assert that the rendered image bounds remain inside the media pane, verify independent detail scrolling, and repeat the check at desktop and mobile viewport sizes.
- Existing frontend and Worker tests, lint, build, typecheck, and Worker deployment dry-run remain green.

## Deployment boundary

Implementation remains local until explicitly finalized. Production enablement later requires:

1. applying the new D1 migration;
2. configuring `REQUESTS_SOURCE_URL`;
3. deploying the independent Worker;
4. running the one-time Sheet import;
5. publishing the updated frontend;
6. publishing the updated Apps Script owner-analytics code.
