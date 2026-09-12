# FD Screenshot Library Ultimate Redesign — Design Specification

**Date:** 2026-09-12  
**Status:** Approved design; implementation not started  
**Product relationship:** A visual sibling of FD Macro Generator, not a clone and not a shared application

## 1. Purpose

Rebuild FD Screenshot Library as a polished, editorial internal product while preserving its existing screenshot-search, copying, request, survey, analytics, and content-management capabilities. The product must visibly belong to the same FD family as FD Macro Generator through shared visual principles, while keeping a gallery-first layout that suits a screenshot library.

The update includes both interface work and a new secure publishing workflow. Named contributors must be able to add content and replace outdated screenshots without receiving a GitHub token. Their accepted changes publish directly. Multiple contributors must be able to publish concurrently without lost updates.

## 2. Goals

1. Establish a clean editorial design with excellent light and dark themes.
2. Make search, categories, screenshot inspection, language switching, and copying significantly faster and clearer.
3. Replace the current Admin page with a contributor-ready Content Studio.
4. Replace the hardcoded client-side admin password and browser-stored GitHub PAT with secure server-side access.
5. Allow named contributors to add and update screenshots directly in production.
6. Prevent concurrent publishes from overwriting unrelated changes.
7. Redesign Screenshot Request, Feedback Survey, Analytics, and Owners as first-class experiences.
8. Preserve existing catalog data, analytics integrations, routes, and core user behavior unless this specification explicitly changes them.

## 3. Non-goals

- Do not merge this product with FD Macro Generator.
- Do not reuse the Macro Generator Worker, D1 database, Durable Object, secrets, deployment, or audit records.
- Do not turn the library into a marketing site.
- Do not add neon effects, decorative particles, large glassmorphism panels, or continuous background animation.
- Do not expose a GitHub token, contributor-code hash, owner bootstrap secret, or privileged API credential to the browser.
- Do not silently resolve two edits to the same field by discarding one contributor's work.
- Do not replace the existing Google Apps Script analytics/request/survey data source in this update.

## 4. Visual direction: same family, different product

### 4.1 Shared FD family traits

The Screenshot Library will adopt the successful qualities of FD Macro Generator's current macOS/editorial layer:

- SF Pro/Inter-style sans-serif typography and tabular numerals where appropriate.
- Crisp FD orange as the single brand accent: `#c2410c` in light mode, with a lightened accessible equivalent in dark mode.
- Compact controls, fine borders, restrained shadows, and clear selected states.
- Light mode built from off-white and cool gray surfaces; dark mode built from graphite surfaces.
- Short, functional motion with spring-like easing.
- Deterministic component states for hover, focus, active, loading, success, warning, and error.

### 4.2 Screenshot Library differences

- No permanent desktop sidebar; visual width is reserved for screenshots.
- Primary navigation is a wide editorial top bar.
- Search is the strongest element on the home page.
- Categories form a horizontal icon rail below search.
- Cards and image inspection receive more space than dense form controls.
- Light theme is the default clean-editorial presentation; the existing persisted theme preference remains respected.

### 4.3 Core tokens

The implementation will define semantic tokens rather than component-specific hardcoded colors:

- Surfaces: page, panel, raised control, inset control, overlay.
- Text: primary, secondary, muted, disabled, on-accent.
- Lines: subtle, default, strong, focus.
- State: accent, positive, negative, warning, information.
- Spacing: 4, 8, 12, 16, 20, 24, 32, and 40 px.
- Radius: 6–8 px for controls, 10–12 px for panels, full-pill only for compact status chips.
- Motion: 90, 140, 200, and 240 ms durations with reduced-motion fallbacks.

All interactive text and icons must meet WCAG AA contrast in both themes.

## 5. Application shell

### 5.1 Primary top bar

The first row contains:

- FD mark and `Screenshot Library` product name.
- Navigation links: Library, Analytics, Owners, and Admin/Content Studio.
- `Request Screenshot` and `Feedback` actions.
- Theme control.
- Signed-in contributor menu when a contributor session exists.

Analytics, Owners analytics, contributor management, and audit views remain permission-gated. The Library, Screenshot Request, and Feedback Survey remain available without contributor access.

### 5.2 Status band

The existing market ticker remains a visually subordinate band beneath the primary bar. It uses the same typography and surface tokens as the shell, pauses its movement when hovered or keyboard-focused, and respects reduced-motion. Network failure displays a quiet stale/offline status rather than invented live prices.

### 5.3 Responsive behavior

- At desktop widths, navigation and main actions remain visible.
- At tablet widths, lower-priority actions move into a compact overflow menu.
- At mobile widths, navigation uses a sheet menu; search and the active filter summary remain directly accessible.
- Sticky elements must not stack over each other or obscure focused controls.

## 6. Library home and search

### 6.1 Editorial introduction

Replace the generic `Welcome Back` content with a compact library introduction containing:

- A clear product heading.
- Total screenshot count derived from data.
- Latest catalog update derived from data.
- A concise usage hint for copying an image or its response text.

No fabricated metric is permitted.

### 6.2 Command search

The search control supports:

- Existing Fuse.js fuzzy matching across title, response text, Turkish response text, topic, language, platform, and owner.
- `/` and `Ctrl/Command + K` focus shortcuts when focus is not inside another editable control.
- Animated focus expansion without layout jump.
- Clear control and Escape-to-clear/close behavior.
- Highlighted matching title and metadata fragments.
- A live result count announced through an ARIA live region.
- Empty-result access to Screenshot Request with the query prefilled.
- Active-filter chips that can be removed individually.

Search and filter state remains local to the Library route. It need not be added to the URL in this update.

### 6.3 Platform, language, favorites, and categories

- Mobile/Web uses a compact segmented control with device icons.
- Records without `platform` remain treated as `mobile` for backward compatibility.
- Language and Favorites use compact filter controls with explicit selected states.
- Mobile filter controls open in an accessible bottom sheet.
- Clearing filters resets search, topic, language, favorites, and platform to their documented defaults.

The seven current category icons are a coherent Lucide-based line-icon family:

| Topic | Icon concept |
| --- | --- |
| Futures Trading | Candlestick chart |
| Margin Trading | Layered balance/scale |
| General | Grid/compass |
| LOAN | Hand and coins |
| Copy Trading | Branch/copy arrows |
| Event Contract | Ticket with pulse |
| BOTS | Bot/circuit |

Each category item contains icon, canonical topic label, and a live catalog count. Category colors are subtle identifiers; orange remains reserved for the selected/action state.

## 7. Screenshot cards and inspection

### 7.1 Card anatomy

Each card contains:

1. Large 16:9 screenshot preview with a robust broken-image state.
2. One compact metadata row for topic/icon, source language, platform, and freshness.
3. A two-line title.
4. Contributor attribution with deterministic initials avatar and accessible tooltip.
5. EN/TR segmented text control when Turkish text exists.
6. Primary `Copy EN` or `Copy TR` action.
7. Secondary Favorite and Inspect actions.
8. Last-updated and last-editor metadata where available.

The current copy fallback for iframe environments remains supported.

### 7.2 Interaction behavior

- Copy morphs to `Copied` with a check icon for approximately 1.4 seconds and also produces a small non-blocking toast.
- EN/TR changes use a sliding orange selection indicator.
- Hover uses restrained elevation, border change, and image scale only.
- Touch devices show actions without relying on hover.
- Text preview opens in the inspection panel rather than expanding the grid card.
- Favorite, view, language-switch, right-click, and copy analytics events continue to fire with the existing event names.

### 7.3 Inspection/lightbox

The lightbox becomes an inspection surface containing:

- Large contained image.
- Previous/next navigation within the current filtered result set.
- Title, topic, language, platform, owner, and updated time.
- EN/TR selection and response-text copy.
- Image-open/fullscreen affordance.
- Escape close, focus trap, focus return, and click-outside behavior.

## 8. Screenshot Request

Screenshot Request remains connected to the existing Apps Script endpoint and existing duplicate-search logic.

The redesigned flow contains:

- A desktop side sheet and mobile full-screen presentation.
- Prefilled search context when opened from an empty Library result.
- A duplicate-suggestion stage before submission.
- Clearly separated request description, additional context, and attempted search terms.
- Inline validation and character counters using the existing limits.
- Submitting, success, rate-limit, and recoverable error states without native alerts.
- A generated client-side request reference shown after successful submission when the server does not return a human-facing ID.

The public request flow receives no content-publishing permission.

## 9. Feedback Survey

The existing ten questions and Apps Script submission contract are preserved. The presentation is split into three visual sections:

1. Usage and satisfaction.
2. Coverage, language, and platform needs.
3. Feature ideas, frustrations, and open feedback.

Requirements:

- Visible progress and Back/Next navigation.
- Required-question validation before advancing.
- Accessible rating controls and icon-assisted choice chips.
- Character counters for free-text limits.
- Draft persistence in local storage until successful submission or explicit reset.
- A final review summary before submission.
- Protection against accidental close while the form has unsaved responses or is submitting.
- Existing 24-hour per-device rate limit and analytics behavior remain intact.

## 10. Analytics and Owners

### 10.1 Analytics navigation

Use a single clear segmented navigation for Overview, Requests, Surveys, and Owners. All panels share the same page header, refresh status, last-successful-load time, loading skeletons, empty states, and error treatment.

### 10.2 Overview

- Rebuild current KPI cards using the editorial token system.
- Use a restrained orange/neutral chart palette plus semantic state colors.
- Preserve real totals, unique-user values, top screenshot, language counts, topic charts, and existing data fetches.
- Tooltips, axes, and legends must work in both themes and at narrow widths.

### 10.3 Requests and Surveys

- Provide search, filter, and sort controls over existing responses.
- Keep wide data tables readable with sticky headers and deliberate column widths.
- Open a selected row in a right-side detail panel rather than forcing every field into the table.
- Preserve direct spreadsheet links and refresh controls.
- Survey aggregates include total responses, satisfaction, search ease, and requested-language tally using real data only.

### 10.4 Owners

Each owner summary includes:

- Deterministic initials avatar.
- Screenshot count.
- Usage since ownership.
- Most-used screenshot.
- Most recent contribution/update.

Selecting an owner opens a profile panel containing their metrics and a filtered screenshot gallery. `Unassigned` remains available only if records still lack an owner after migration. Owner metric definitions are explained through concise tooltips.

## 11. Owner migration

The migration updates only records without an existing owner:

| Existing language | Assigned owner |
| --- | --- |
| English | CS Gorkem T |
| Arabic | CS Gorkem T |
| Russian | CS Gorkem T |
| Vietnamese | CS Gorkem T |
| Chinese | CS Enzo |

Existing `CS VERA` ownership is preserved. For migrated records, `ownerSince` is derived from the record's numeric creation `id` when it is a valid epoch timestamp. If a record lacks a valid creation timestamp, its existing `updatedAt` is used when parseable; otherwise the migration execution time is used and the fallback is reported.

New content defaults `owner` to the signed-in contributor display name. An Owner may explicitly select another owner.

## 12. Content Studio

### 12.1 Layout

The current Admin card grid and modal are replaced with a purpose-built workspace:

- Searchable, filterable content list on the left/top depending on viewport.
- Selected-record editor and preview on the right/main area.
- Filters for topic, language, platform, owner, and freshness.
- Status summary for total, recently updated, and unassigned records.
- Explicit `Add Screenshot` action.

Contributor-facing record actions are Edit content, Replace image, Duplicate as new, and Inspect. Archive/delete and rollback actions require Owner role.

### 12.2 Content editor

The editor contains:

- Platform segmented control.
- Title.
- Topic selector with controlled new-topic creation.
- Source language.
- Owner selector; contributor defaults to self.
- EN response and TR response tabs with large editing areas, character information, and rendered preview.
- Current-image preview.
- Drag/drop and file-picker replacement area.
- New-image preview and Current/New comparison mode.
- Dirty-field tracking and unsaved-change protection.
- Validation summary anchored to the relevant controls.
- Save-and-publish action with progress steps.

Supported image types are JPEG, PNG, and WebP. The server enforces a documented maximum upload size of 12 MB. SVG uploads are rejected because submitted SVG can contain active content. The client may warn about unusually small dimensions but does not reject a screenshot solely by dimensions.

### 12.3 Publish result

On success, Content Studio:

- Replaces local data with the canonical server result.
- Shows the commit reference, contributor name, and timestamp.
- Clears dirty state.
- Updates the selected record without a full-page reload.
- Makes the new image URL cache-safe.

Native `alert()` and `window.confirm()` are replaced by inline status, toast, and explicit confirmation-dialog components.

## 13. Access Management

### 13.1 Roles

`owner` role:

- All contributor permissions.
- Create, disable, re-enable, and rotate contributor access.
- View audit history.
- Archive/delete and roll back content.
- Access Analytics and Owners analytics.

`contributor` role:

- Sign in with personal access code.
- Add screenshots.
- Update metadata, text, owner attribution, and images.
- Publish directly.
- View their own recent publish activity.

Contributors cannot manage access, read secret hashes, delete/rollback records, or access privileged analytics.

### 13.2 Personal access codes

- An Owner creates a contributor with a unique display name.
- The API generates a cryptographically random code.
- The full code is returned exactly once for the Owner to copy.
- Only a salted password hash is stored.
- Rotation immediately invalidates the previous code and active sessions for that contributor.
- Disabling a contributor invalidates their active sessions.
- Successful login exchanges the code for a short-lived signed session token.
- Browser session state uses session storage, not persistent local storage.

The initial Owner is bootstrapped from a dedicated Worker secret and then manages contributors through the UI.

## 14. Independent Screenshot Library API

### 14.1 Isolation requirement

The new backend is a completely separate Cloudflare project from FD Macro Generator.

- Repository directory: `worker/` inside FD Screenshot Library.
- Cloudflare Worker name: `fd-screenshot-library-api`.
- Separate D1 database binding.
- Separate Durable Object namespace.
- Separate secrets, allowed-origin configuration, deployment documentation, and audit tables.
- No imports, runtime calls, or storage sharing with Macro Generator.

### 14.2 Server responsibilities

- Authenticate personal access codes and sessions.
- Authorize role-specific endpoints.
- Hold the GitHub credential as a Worker secret.
- Validate and sanitize content payloads.
- Validate image type, size, filename, and binary signature.
- Serialize repository writes.
- Create atomic commits containing the image operation and data change.
- Return the canonical committed record/data version.
- Store access and audit information.
- Apply per-IP and per-contributor rate limits to authentication and publishing.

### 14.3 D1 entities

`contributors`:

- `id`, `display_name`, `role`, `code_hash`, `code_salt`, `status`, `created_at`, `updated_at`, `last_login_at`, `code_version`.

`sessions`:

- `id`, `contributor_id`, `token_hash`, `expires_at`, `created_at`, `revoked_at`.

`audit_events`:

- `id`, `contributor_id`, `action`, `record_id`, `commit_sha`, `changed_fields_json`, `before_json`, `after_json`, `created_at`, `request_id`.

No raw access code, GitHub token, or full session token is stored.

### 14.4 API surface

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /content`
- `POST /content`
- `PATCH /content/:id`
- `POST /content/:id/replace-image`
- `POST /content/:id/resolve-conflict`
- `POST /content/:id/archive` — Owner only
- `POST /content/:id/rollback` — Owner only
- `GET /contributors` — Owner only
- `POST /contributors` — Owner only
- `PATCH /contributors/:id` — Owner only
- `POST /contributors/:id/rotate-code` — Owner only
- `GET /audit` — Owner only

Every mutating request accepts an idempotency key. Repeating a completed request with the same key returns its original result rather than producing a second commit.

## 15. Concurrent publishing and conflict handling

### 15.1 Serialization

All repository mutations pass through one Screenshot Library Durable Object. Requests are processed in arrival order. For each request the Worker:

1. Validates authentication, authorization, schema, image, rate limit, and idempotency key.
2. Reads the latest `main` branch reference and current `src/data/data.json`.
3. Locates the target record by immutable numeric `id`.
4. Compares the client's base record/version and dirty-field patch with the latest record.
5. Applies the safe patch or returns a structured conflict.
6. Creates image blobs where needed.
7. Creates a tree containing the canonical data file and required image changes.
8. Creates and advances a non-forced Git commit.
9. Retries from step 2 if the branch moved outside the queue, using a bounded retry policy.
10. Writes the audit event and returns canonical content.

This guarantees that five contributors editing five different records all succeed without one publish replacing another's data.

### 15.2 Same-record edits

The client submits only dirty fields plus a base record hash/version.

- If the latest record matches the base, apply the patch.
- If remote fields changed but do not intersect the submitted dirty fields, merge automatically.
- If the same field changed remotely and locally, return HTTP `409` with base, remote, and submitted values for conflicting fields.
- Content Studio displays a comparison UI with per-field `Keep latest` and `Use mine` choices.
- Conflict resolution is submitted as a new idempotent mutation against the newly returned base version.

No silent last-write-wins behavior is allowed for intersecting changes.

### 15.3 Image replacement

Image replacement and record update occur in one commit. The record begins referencing the new image only when that commit succeeds. The previous image is removed from the current tree when it is no longer referenced by another record; Git history still permits rollback. A failed mutation must not change `data.json`. Unreferenced Git blobs created during a failed attempt are acceptable and are not publicly addressable from the branch tree.

## 16. Error handling and recovery

- Authentication errors distinguish invalid, disabled, expired, and rate-limited states without revealing whether arbitrary contributor names exist.
- Publish progress uses `Validating`, `Uploading image`, `Publishing`, and `Complete` states.
- Recoverable network failures retain unsaved form state and offer retry using the same idempotency key.
- A concurrency conflict preserves the local draft until resolved or explicitly discarded.
- Data-source failures in public analytics/request/survey features do not block the Library.
- Error messages contain a request reference suitable for support without exposing secrets.
- Route-level error boundaries prevent one panel from blanking the entire application.

## 17. Motion and accessibility

- Page/panel entry: 140–200 ms fade and small translation.
- Active navigation/category indicator: 200–240 ms spring transition.
- Copy success: 1.4-second morph, announced without stealing focus.
- Toast: bottom-right desktop and bottom-center mobile; no stacked permanent notifications.
- Image loading: neutral skeleton/canvas, not a spinner over content.
- Modal and sheet transitions: 200–240 ms.
- `prefers-reduced-motion` removes translation, scale, ticker movement, and nonessential transition.
- Every modal/sheet has focus trap, Escape close where safe, labelled controls, and focus return.
- Unsaved forms require an explicit discard decision before closing.
- Icon-only controls have accessible names and tooltips.

## 18. Verification and acceptance criteria

### 18.1 Existing behavior

- Production build succeeds.
- Existing data loads and all 110 current records remain present after migration.
- Search, category, language, platform, favorite, EN/TR, copy fallback, lightbox, Request, Survey, Analytics, and Owner fetches continue working.
- Current analytics event names remain unchanged.

### 18.2 Visual quality

- Desktop, tablet, and mobile layouts are visually inspected in light and dark mode.
- Long titles, missing owner, missing platform, missing Turkish text, broken images, empty results, loading, and errors render intentionally.
- Card heights and grid behavior remain stable during image loading and language changes.
- Focus visibility and AA contrast are verified.

### 18.3 Content Studio

- Owner bootstrap and login work without browser-visible GitHub credentials.
- Owner can create, rotate, disable, and re-enable a contributor.
- Contributor can add a screenshot and directly publish it.
- Contributor can replace an existing image and edit EN/TR text in one publish.
- A successful publish updates the UI without reloading.
- Owner-only actions reject contributor sessions at the API layer.
- Owner migration assigns languages exactly as specified and preserves CS VERA.

### 18.4 Concurrency

- Five concurrent edits to different records all commit and remain in the final data file.
- Concurrent disjoint-field edits to one record merge.
- Concurrent same-field edits return a conflict and neither edit is silently lost.
- Replaying an idempotency key does not produce a duplicate record or commit.
- A failed image publish leaves the current record and image reference unchanged.

### 18.5 Security

- No hardcoded `admin123` path remains.
- No GitHub token is stored in local/session storage or shipped in the frontend bundle.
- Contributor codes are only displayed once and stored as salted hashes.
- CORS permits only configured Screenshot Library origins.
- Login and mutation endpoints are rate-limited.
- SVG and spoofed image uploads are rejected.

## 19. Delivery boundary

The repository will contain the frontend, the independent `worker/` project, D1 migrations, tests, owner-data migration, and deployment documentation. Actual Cloudflare deployment requires the target account and secrets to be configured. The frontend must expose a documented environment variable for the independently deployed Screenshot Library API URL and must fail safely when that URL is absent.
