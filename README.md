# FD Screenshot Library

FD Screenshot Library is the editorial reference catalog for support teams. The application combines fast screenshot discovery, EN/TR copy-ready guidance, contributor attribution, screenshot requests, feedback surveys, and a protected Content Studio.

The visual system belongs to the same product family as FD Macro Generator—shared typography, color tokens, surface language, and interaction rhythm—while the gallery keeps its own wider editorial navigation, category rail, and image-first inspector.

## What is included

- Searchable screenshot gallery with animated search, category filters, language signals, owner credits, copy actions, and a focused inspector.
- Responsive light/dark interface for desktop and mobile.
- Screenshot Request and multi-step Survey flows with validation, duplicate hints, drafts, and analytics routing.
- Owner-only Analytics and Owner attribution views.
- Content Studio for creating, editing, replacing, archiving, and restoring screenshot entries.
- Personal contributor access codes, role controls, code rotation/revocation, and audit history.
- A separate Cloudflare Worker that serializes catalog writes and performs conflict-aware GitHub commits.

## Local development

Requirements: Node.js 20+ and npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

The frontend opens at `http://localhost:5173/screenshot-library/`. Set `VITE_CONTENT_API_URL` in `.env.local` to the separately running Worker URL.

```bash
npm test
npm run lint
npm run build
```

The production bundle is written to `dist/`.

## Content Studio

Open `/admin` and sign in with a personal contributor code. Tokens and GitHub credentials are never requested or stored by the browser.

Contributors can:

- create a new screenshot record;
- edit EN/TR titles and response text;
- replace an existing image while keeping the record identity;
- resolve field-level conflicts when another contributor edited the same record;
- view their recent audit trail.

Owners can additionally create, rotate, disable, and re-enable contributor access; inspect all audit events; archive content; and restore a previous catalog version.

Worker setup, security, D1 migrations, and production configuration are documented in [`worker/README.md`](worker/README.md).

## Safe concurrent publishing

Every mutation is sent with an idempotency key and the revision the editor started from. A Durable Object serializes writes, reads the latest repository state inside the queue, merges non-overlapping field changes, and returns an explicit `409` payload for overlapping changes. The image and `data.json` update are committed together, so replacing an image cannot leave a half-published catalog state.

## Ownership rules

The catalog migration assigns uncredited EN, AR, RU, and VI screenshots to **CS Gorkem T**; CN screenshots to **CS Enzo**; and preserves existing **CS VERA** ownership. Run the idempotent migration with:

```bash
node scripts/migrate-owners.mjs
```

## Requests, surveys, and analytics

Public request and survey submissions continue through the existing Google Apps Script endpoint. The Analytics workspace reads its request, survey, and interaction views from that service. The Worker is intentionally responsible only for authenticated catalog publishing and contributor management.

For Apps Script installation details, see [`apps-script/owner-analytics.gs`](apps-script/owner-analytics.gs) and the comments in the existing analytics service.

## Deployment boundary

The frontend and Worker are independent deployments:

1. Deploy `worker/` as the dedicated `fd-screenshot-library-api` Cloudflare project.
2. Build the frontend with `VITE_CONTENT_API_URL` set to that Worker URL.
3. Publish the frontend through its existing GitHub Pages workflow.

Do not reuse FD Macro Generator's Worker, D1 database, secrets, or Durable Object namespace.
