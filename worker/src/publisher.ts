import { applyCatalogMutation, CatalogConflictError, imageTypeFromSignature, safeImageName, type CatalogItem, type CatalogMutation } from './catalog';
import { advanceBranch, createCommit, createImageBlob, dataTreeEntry, deleteTreeEntry, imageTreeEntry, readRepoState } from './github';
import { json } from './http';
import type { Env, Principal } from './types';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

interface InternalPayload extends CatalogMutation {
  resolution?: Record<string, 'latest' | 'mine'>;
}

async function parseMutation(request: Request): Promise<{ payload: InternalPayload; image: File | null }> {
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const payloadValue = form.get('payload');
    if (typeof payloadValue !== 'string') throw new Error('Mutation payload is required.');
    const file = form.get('image');
    return { payload: JSON.parse(payloadValue) as InternalPayload, image: file instanceof File ? file : null };
  }
  return { payload: await request.json<InternalPayload>(), image: null };
}

function internalPrincipal(request: Request): Principal {
  const value = request.headers.get('X-FDSL-Principal');
  if (!value) throw new Error('Internal principal is missing.');
  return JSON.parse(value) as Principal;
}

function requireOwner(principal: Principal, action: string): void {
  if (principal.role !== 'owner' && ['archive', 'rollback'].includes(action)) throw new Error('Owner access is required for this action.');
}

function oldImageCanBeRemoved(before: CatalogItem | null, items: CatalogItem[], nextImage: string): string | null {
  const oldImage = String(before?.image || '');
  if (!oldImage.startsWith('screenshots/') || oldImage === nextImage) return null;
  return items.some((item) => item.id !== before?.id && item.image === oldImage) ? null : oldImage;
}

export class CatalogWriter {
  private tail: Promise<void> = Promise.resolve();

  constructor(private state: DurableObjectState, private env: Env) {
    void this.state;
  }

  fetch(request: Request): Promise<Response> {
    const task = this.tail.then(() => this.handle(request));
    this.tail = task.then(() => undefined, () => undefined);
    return task;
  }

  private async handle(request: Request): Promise<Response> {
    const requestId = request.headers.get('X-Request-Id') || crypto.randomUUID();
    const idempotencyKey = request.headers.get('Idempotency-Key');
    const principal = internalPrincipal(request);
    if (!idempotencyKey || idempotencyKey.length < 16) return json({ error: 'A valid idempotency key is required.', code: 'IDEMPOTENCY_REQUIRED' }, 400, requestId);

    const completed = await this.env.DB.prepare('SELECT response_json FROM idempotency_keys WHERE key = ? AND contributor_id = ? AND status = ?')
      .bind(idempotencyKey, principal.id, 'complete').first<{ response_json: string }>();
    if (completed?.response_json) return json(JSON.parse(completed.response_json), 200, requestId);

    const claim = await this.env.DB.prepare('INSERT OR IGNORE INTO idempotency_keys (key, contributor_id, status, created_at) VALUES (?, ?, ?, ?)')
      .bind(idempotencyKey, principal.id, 'processing', new Date().toISOString()).run();
    if (!claim.meta.changes) return json({ error: 'This publish request is already processing.', code: 'PUBLISH_IN_PROGRESS' }, 409, requestId);

    try {
      const { payload, image } = await parseMutation(request);
      requireOwner(principal, payload.action);
      const result = await this.publish(payload, image, principal, requestId);
      await this.env.DB.prepare('UPDATE idempotency_keys SET status = ?, response_json = ?, completed_at = ? WHERE key = ?')
        .bind('complete', JSON.stringify(result), new Date().toISOString(), idempotencyKey).run();
      return json(result, 200, requestId);
    } catch (error) {
      await this.env.DB.prepare('DELETE FROM idempotency_keys WHERE key = ? AND status = ?').bind(idempotencyKey, 'processing').run();
      if (error instanceof CatalogConflictError) return json({ error: error.message, code: 'EDIT_CONFLICT', conflicts: error.conflicts, latest: error.latest }, 409, requestId);
      const message = error instanceof Error ? error.message : 'Publishing failed.';
      const status = message.includes('Owner access') ? 403 : message.includes('not found') ? 404 : 400;
      return json({ error: message, code: 'PUBLISH_FAILED' }, status, requestId);
    }
  }

  private async publish(payload: InternalPayload, image: File | null, principal: Principal, requestId: string): Promise<Record<string, unknown>> {
    const imageBytes = image ? new Uint8Array(await image.arrayBuffer()) : null;
    let imageMime: string | null = null;
    if (imageBytes) {
      if (imageBytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Image must be 12 MB or smaller.');
      imageMime = imageTypeFromSignature(imageBytes);
      if (!imageMime || !['image/png', 'image/jpeg', 'image/webp'].includes(imageMime)) throw new Error('Image must be a genuine PNG, JPEG, or WebP file.');
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const state = await readRepoState(this.env);
      const now = new Date().toISOString();
      let mutationResult: ReturnType<typeof applyCatalogMutation>;

      if (payload.action === 'rollback') {
        const audit = await this.env.DB.prepare('SELECT before_json FROM audit_events WHERE record_id = ? AND before_json IS NOT NULL ORDER BY created_at DESC LIMIT 1')
          .bind(String(payload.recordId)).first<{ before_json: string }>();
        if (!audit?.before_json) throw new Error('No rollback snapshot was found.');
        const prior = JSON.parse(audit.before_json) as CatalogItem;
        const index = state.items.findIndex((item) => item.id === payload.recordId);
        if (index < 0) throw new Error('Screenshot record was not found.');
        const before = state.items[index]!;
        const record: CatalogItem = { ...prior, updatedAt: now, updatedBy: principal.displayName, version: crypto.randomUUID() };
        const items = [...state.items];
        items[index] = record;
        mutationResult = { items, record, before, changedFields: Object.keys(record) };
      } else {
        mutationResult = applyCatalogMutation(state.items, payload, {
          now,
          contributor: principal.displayName,
          nextId: Date.now(),
          version: crypto.randomUUID(),
        });
      }

      const entries = [];
      if (imageBytes && imageMime && image) {
        const imagePath = safeImageName(image.name, imageMime, Date.now());
        const blobSha = await createImageBlob(this.env, imageBytes);
        mutationResult.record.image = imagePath;
        entries.push(imageTreeEntry(imagePath, blobSha));
        const removable = oldImageCanBeRemoved(mutationResult.before, mutationResult.items, imagePath);
        if (removable) entries.push(deleteTreeEntry(removable));
        if (!mutationResult.changedFields.includes('image')) mutationResult.changedFields.push('image');
      }
      if (!mutationResult.record.image) throw new Error('A screenshot image is required.');

      entries.push(dataTreeEntry(mutationResult.items));
      const message = `${payload.action.toUpperCase()}: ${String(mutationResult.record.title || mutationResult.record.id)} by ${principal.displayName}`;
      const commitSha = await createCommit(this.env, state, entries, message);
      if (!(await advanceBranch(this.env, commitSha))) continue;

      await this.env.DB.prepare(`
        INSERT INTO audit_events (id, contributor_id, action, record_id, commit_sha, changed_fields_json, before_json, after_json, created_at, request_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(), principal.id, payload.action, String(mutationResult.record.id), commitSha,
        JSON.stringify(mutationResult.changedFields), mutationResult.before ? JSON.stringify(mutationResult.before) : null,
        JSON.stringify(mutationResult.record), now, requestId,
      ).run();

      return { ok: true, record: mutationResult.record, commitSha, publishedAt: now, contributor: principal.displayName };
    }
    throw new Error('The repository changed repeatedly. Retry this publish.');
  }
}
