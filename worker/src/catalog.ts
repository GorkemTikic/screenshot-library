export type CatalogValue = string | number | boolean | null | undefined;
export type CatalogItem = Record<string, CatalogValue> & { id: number; title?: string; version?: string };

const EDITABLE_FIELDS = new Set(['title', 'text', 'text_tr', 'topic', 'language', 'platform', 'owner', 'ownerSince']);

export interface CatalogMutation {
  action: 'create' | 'update' | 'replace-image' | 'archive' | 'rollback' | 'resolve-conflict';
  recordId?: number;
  baseRecord?: CatalogItem;
  patch: Record<string, unknown>;
}

export interface MutationMetadata {
  now: string;
  contributor: string;
  nextId: number;
  version: string;
}

export interface FieldConflict {
  base: unknown;
  latest: unknown;
  mine: unknown;
}

export class CatalogConflictError extends Error {
  constructor(public conflicts: Record<string, FieldConflict>, public latest: CatalogItem) {
    super('The record changed while you were editing.');
  }
}

const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export function sanitizePatch(input: Record<string, unknown>): Record<string, CatalogValue> {
  const patch: Record<string, CatalogValue> = {};
  for (const [field, value] of Object.entries(input)) {
    if (!EDITABLE_FIELDS.has(field)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) patch[field] = value;
  }
  return patch;
}

export function detectConflicts(base: CatalogItem, latest: CatalogItem, patch: Record<string, unknown>): Record<string, FieldConflict> {
  const conflicts: Record<string, FieldConflict> = {};
  for (const [field, mine] of Object.entries(patch)) {
    if (!equal(base[field], latest[field])) conflicts[field] = { base: base[field], latest: latest[field], mine };
  }
  return conflicts;
}

export function validateCatalogRecord(item: CatalogItem): void {
  if (!String(item.title || '').trim()) throw new Error('Title is required.');
  if (!String(item.text || '').trim()) throw new Error('English/source response text is required.');
  if (!String(item.topic || '').trim()) throw new Error('Topic is required.');
  if (!String(item.language || '').trim()) throw new Error('Language is required.');
  if (!['mobile', 'web'].includes(String(item.platform || 'mobile'))) throw new Error('Platform must be mobile or web.');
  if (String(item.title).length > 240) throw new Error('Title must be 240 characters or fewer.');
  if (String(item.text).length > 20_000 || String(item.text_tr || '').length > 20_000) throw new Error('Response text must be 20,000 characters or fewer.');
}

export function applyCatalogMutation(items: CatalogItem[], mutation: CatalogMutation, metadata: MutationMetadata): {
  items: CatalogItem[];
  record: CatalogItem;
  before: CatalogItem | null;
  changedFields: string[];
} {
  const patch = sanitizePatch(mutation.patch || {});
  if (mutation.action === 'create') {
    const record: CatalogItem = {
      ...patch,
      id: metadata.nextId,
      platform: patch.platform || 'mobile',
      owner: patch.owner || metadata.contributor,
      ownerSince: patch.ownerSince || metadata.now,
      updatedAt: metadata.now,
      updatedBy: metadata.contributor,
      version: metadata.version,
    };
    validateCatalogRecord(record);
    return { items: [record, ...items], record, before: null, changedFields: Object.keys(record) };
  }

  const index = items.findIndex((item) => item.id === mutation.recordId);
  if (index < 0) throw new Error('Screenshot record was not found.');
  const before = items[index]!;
  if (mutation.baseRecord) {
    const conflicts = detectConflicts(mutation.baseRecord, before, patch);
    if (Object.keys(conflicts).length) throw new CatalogConflictError(conflicts, before);
  }

  const serverPatch: Record<string, CatalogValue> = mutation.action === 'archive'
    ? { archivedAt: metadata.now, archivedBy: metadata.contributor }
    : patch;
  const record: CatalogItem = {
    ...before,
    ...serverPatch,
    updatedAt: metadata.now,
    updatedBy: metadata.contributor,
    version: metadata.version,
  };
  validateCatalogRecord(record);
  const nextItems = [...items];
  nextItems[index] = record;
  return {
    items: nextItems,
    record,
    before,
    changedFields: [...Object.keys(serverPatch), 'updatedAt', 'updatedBy', 'version'],
  };
}

export function imageTypeFromSignature(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const ascii = new TextDecoder().decode(bytes.slice(0, 12));
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function safeImageName(name: string, mime: string, timestamp: number): string {
  const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const stem = name.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'screenshot';
  return `screenshots/${timestamp}_${stem}.${extension}`;
}
