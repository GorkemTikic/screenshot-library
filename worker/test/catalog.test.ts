import { describe, expect, it } from 'vitest';
import {
  applyCatalogMutation,
  assertImageReplacementIsCurrent,
  buildRollbackRecord,
  detectConflicts,
  imageTypeFromSignature,
  ownerKeyFromName,
  sanitizePatch,
  transferImageOwnership,
} from '../src/catalog';
import type { CatalogItem } from '../src/catalog';

const base = { id: 7, title: 'Title', text: 'Text', topic: 'General', language: 'English', platform: 'mobile', owner: 'CS Gorkem T', version: 'v1' };

describe('catalog patch safety', () => {
  it('keeps editable fields and strips protected or unknown fields', () => {
    expect(sanitizePatch({ title: 'New', id: 99, image: 'evil.svg', owner: 'Spoof', ownerSince: 'yesterday', ownerHistory: [], updatedBy: 'spoof', unknown: true })).toEqual({ title: 'New' });
  });

  it('merges disjoint fields and detects intersecting field changes', () => {
    const latest = { ...base, text: 'Remote text', version: 'v2' };
    expect(detectConflicts(base, latest, { title: 'My title' })).toEqual({});
    expect(detectConflicts(base, latest, { text: 'My text' })).toEqual({ text: { base: 'Text', latest: 'Remote text', mine: 'My text' } });
  });

  it('applies create, update and archive without removing other records', () => {
    const created = applyCatalogMutation([base], { action: 'create', patch: { title: 'Second', text: 'Body', topic: 'LOAN', language: 'English', platform: 'mobile', owner: 'CS Enzo' } }, { now: '2026-09-12T12:00:00.000Z', contributor: 'CS Enzo', contributorKey: 'cs-enzo', nextId: 8, version: 'v8' });
    expect(created.items.map((item) => item.id)).toEqual([8, 7]);
    const updated = applyCatalogMutation(created.items, { action: 'update', recordId: 7, baseRecord: base, patch: { title: 'Updated' } }, { now: '2026-09-12T12:01:00.000Z', contributor: 'CS Gorkem T', contributorKey: 'cs-gorkem-t', nextId: 9, version: 'v9' });
    expect(updated.items.find((item) => item.id === 7)?.title).toBe('Updated');
    expect(updated.items.find((item) => item.id === 8)?.title).toBe('Second');
    const archived = applyCatalogMutation(updated.items, { action: 'archive', recordId: 7, baseRecord: updated.record, patch: {} }, { now: '2026-09-12T12:02:00.000Z', contributor: 'CS Gorkem T', contributorKey: 'cs-gorkem-t', nextId: 10, version: 'v10' });
    expect(archived.record.archivedBy).toBe('CS Gorkem T');
  });

  it('creates ownership from the authenticated contributor and ignores spoofing', () => {
    const created = applyCatalogMutation([], { action: 'create', patch: { title: 'Guide', text: 'Body', topic: 'General', language: 'English', platform: 'mobile', owner: 'Spoof' } }, { now: '2026-09-12T12:00:00Z', contributor: 'CS Enzo', contributorKey: 'cs-enzo', nextId: 8, version: 'v8' });
    expect(created.record).toMatchObject({ owner: 'CS Enzo', ownerKey: 'cs-enzo', ownerSince: '2026-09-12T12:00:00Z' });
    expect(created.record.ownerHistory).toEqual([{ ownerKey: 'cs-enzo', owner: 'CS Enzo', from: '2026-09-12T12:00:00Z', to: null, reason: 'created', changedBy: 'CS Enzo' }]);
  });

  it('transfers ownership only for a genuine image replacement', () => {
    const before = { ...base, image: 'screenshots/old.png', ownerKey: 'cs-gorkem-t', ownerSince: '2026-01-01', ownerHistory: [{ ownerKey: 'cs-gorkem-t', owner: 'CS Gorkem T', from: null, to: null, reason: 'initial-attribution', changedBy: 'migration' }] };
    const textOnly = applyCatalogMutation([before], { action: 'update', recordId: 7, baseRecord: before, patch: { text: 'Edited' } }, { now: '2026-09-12T12:00:00Z', contributor: 'CS Enzo', contributorKey: 'cs-enzo', nextId: 9, version: 'v9' });
    expect(textOnly.record.owner).toBe('CS Gorkem T');
    expect(textOnly.record.ownerHistory).toEqual(before.ownerHistory);

    const replacement: CatalogItem = { ...textOnly.record, image: 'screenshots/new.png' };
    transferImageOwnership(replacement, before, 'CS Enzo', 'cs-enzo', '2026-09-12T12:01:00Z');
    expect(replacement.owner).toBe('CS Enzo');
    expect(replacement.ownerHistory).toEqual([
      { ...before.ownerHistory[0], to: '2026-09-12T12:01:00Z' },
      { ownerKey: 'cs-enzo', owner: 'CS Enzo', from: '2026-09-12T12:01:00Z', to: null, reason: 'image-replaced', changedBy: 'CS Enzo' },
    ]);
  });

  it('same-owner replacement does not split history and image rollback transfers safely', () => {
    const before = { ...base, image: 'screenshots/current.png', ownerKey: 'cs-gorkem-t', ownerSince: '2026-01-01', ownerHistory: [{ ownerKey: 'cs-gorkem-t', owner: 'CS Gorkem T', from: null, to: null, reason: 'initial-attribution', changedBy: 'migration' }] };
    const sameOwner = { ...before, image: 'screenshots/new.png', ownerHistory: structuredClone(before.ownerHistory) };
    transferImageOwnership(sameOwner, before, 'CS Gorkem T (renamed)', 'cs-gorkem-t', '2026-09-12T12:00:00Z');
    expect(sameOwner.ownerHistory).toHaveLength(1);
    const rollback = buildRollbackRecord(sameOwner, { ...before, text: 'Earlier copy' }, 'CS Enzo', 'cs-enzo', '2026-09-12T13:00:00Z', 'v10');
    expect(rollback.image).toBe('screenshots/current.png');
    expect(rollback.text).toBe('Earlier copy');
    expect(rollback.owner).toBe('CS Enzo');
    expect(ownerKeyFromName(rollback.owner as string)).toBe('cs-enzo');
    expect((rollback.ownerHistory as Array<Record<string, unknown>>)).toHaveLength(2);
  });

  it('rejects a replacement when the image changed after the editor opened', () => {
    const opened = { ...base, image: 'screenshots/original.png' };
    const latest = { ...base, image: 'screenshots/someone-elses-replacement.png', version: 'v2' };
    expect(() => assertImageReplacementIsCurrent(opened, latest)).toThrow('changed while you were editing');
    expect(() => assertImageReplacementIsCurrent(opened, opened)).not.toThrow();
  });
});

describe('image signature validation', () => {
  it('recognizes PNG, JPEG and WebP and rejects SVG text', () => {
    expect(imageTypeFromSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(imageTypeFromSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(imageTypeFromSignature(new TextEncoder().encode('RIFFxxxxWEBP'))).toBe('image/webp');
    expect(imageTypeFromSignature(new TextEncoder().encode('<svg onload="x">'))).toBeNull();
  });
});
