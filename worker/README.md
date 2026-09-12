# FD Screenshot Library API

This Worker is dedicated to FD Screenshot Library. It is intentionally separate from FD Macro Generator.

## Request workflow

Apply both D1 migrations before starting a new local database:

```powershell
npx wrangler d1 migrations apply fd-screenshot-library --local --config worker/wrangler.toml
```

`REQUESTS_SOURCE_URL` points to the deployed Apps Script `?getRequests=true` read endpoint for the owner-only historical import. Request state is live in D1 and serialized by `RequestWriter`; `src/data/requests.json` is the repository fallback snapshot.

Authenticated contributors can read and update `/requests`. Only owners can call `/requests/import` and `/requests/resync`. Public users may only create a sanitized request through `POST /requests`.

This directory is an independent Cloudflare Worker project for FD Screenshot Library. It must not share the FD Macro Generator Worker, D1 database, secrets, or Durable Object namespace.

## Architecture

- D1 stores contributors, signed-session records, audit events, and idempotency results.
- `CatalogWriter` is the single write coordinator for catalog mutations.
- GitHub remains the source of truth for `src/data/data.json` and screenshot assets.
- Fine-grained conflict detection merges different fields safely and asks the editor to resolve overlapping changes.
- A screenshot replacement and its JSON update are published in one Git commit.

## First-time Cloudflare setup

From `worker/`:

```bash
npm install
npx wrangler login
npx wrangler d1 create fd-screenshot-library
```

Copy the returned database ID into `wrangler.toml`, replacing the all-zero placeholder. Then apply the schema:

```bash
npx wrangler d1 migrations apply fd-screenshot-library --remote
```

Configure three secrets:

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put SESSION_SECRET
npx wrangler secret put OWNER_BOOTSTRAP_CODE
```

- `GITHUB_TOKEN`: fine-grained token restricted to this repository with Contents read/write permission.
- `SESSION_SECRET`: long random value used to sign eight-hour sessions.
- `OWNER_BOOTSTRAP_CODE`: operational bootstrap code used to establish the first owner session. Keep it outside the frontend and rotate it after owner access is established.

Review these non-secret variables in `wrangler.toml` before deployment:

- `GITHUB_OWNER`, `GITHUB_REPO`, and `GITHUB_BRANCH`
- `ALLOWED_ORIGINS`, as a comma-separated exact allowlist

## Validate and run

```bash
npm test
npm run typecheck
npx wrangler deploy --dry-run
npm run dev
```

Local development runs on `http://localhost:8787` by default. Point the frontend's `VITE_CONTENT_API_URL` there.

## Deploy

```bash
npm run deploy
```

After deployment, set the frontend build variable to the resulting Worker URL:

```text
VITE_CONTENT_API_URL=https://fd-screenshot-library-api.<account>.workers.dev
```

Rebuild and publish the frontend only after the Worker health check and owner login succeed.

## Access operations

The owner signs in with the bootstrap code, opens Content Studio → Access, and creates a named contributor. The generated personal code is displayed once. Owners can later rotate or disable that contributor and inspect the audit event produced by every change.

Never place access codes, `GITHUB_TOKEN`, or `SESSION_SECRET` in Git, frontend environment variables, screenshots, or issue comments.

## Concurrent edits

Clients submit the base catalog revision and changed fields. All writes pass through `CatalogWriter`, which re-fetches the latest GitHub revision before committing. Non-overlapping edits from multiple people are merged in queue order. Overlapping edits return `409 Conflict` with the current and proposed values; Content Studio presents a field-by-field resolver instead of silently overwriting either edit.
