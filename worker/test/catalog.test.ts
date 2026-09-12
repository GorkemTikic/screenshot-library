import { describe, expect, it } from 'vitest';
import {
  applyCatalogMutation,
  detectConflicts,
  imageTypeFromSignature,
  sanitizePatch,
} from '../src/catalog';

const base = { id: 7, title: 'Title', text: 'Text', topic: 'General', language: 'English', platform: 'mobile', owner: 'CS Gorkem T', version: 'v1' };

describe('catalog patch safety', () => {
  it('keeps editable fields and strips protected or unknown fields', () => {
    expect(sanitizePatch({ title: 'New', id: 99, image: 'evil.svg', updatedBy: 'spoof', unknown: true })).toEqual({ title: 'New' });
  });

  it('merges disjoint fields and detects intersecting field changes', () => {
    const latest = { ...base, text: 'Remote text', version: 'v2' };
    expect(detectConflicts(base, latest, { title: 'My title' })).toEqual({});
    expect(detectConflicts(base, latest, { text: 'My text' })).toEqual({ text: { base: 'Text', latest: 'Remote text', mine: 'My text' } });
  });

  it('applies create, update and archive without removing other records', () => {
    const created = applyCatalogMutation([base], { action: 'create', patch: { title: 'Second', text: 'Body', topic: 'LOAN', language: 'English', platform: 'mobile', owner: 'CS Enzo' } }, { now: '2026-09-12T12:00:00.000Z', contributor: 'CS Enzo', nextId: 8, version: 'v8' });
    expect(created.items.map((item) => item.id)).toEqual([8, 7]);
    const updated = applyCatalogMutation(created.items, { action: 'update', recordId: 7, baseRecord: base, patch: { title: 'Updated' } }, { now: '2026-09-12T12:01:00.000Z', contributor: 'CS Gorkem T', nextId: 9, version: 'v9' });
    expect(updated.items.find((item) => item.id === 7)?.title).toBe('Updated');
    expect(updated.items.find((item) => item.id === 8)?.title).toBe('Second');
    const archived = applyCatalogMutation(updated.items, { action: 'archive', recordId: 7, baseRecord: updated.record, patch: {} }, { now: '2026-09-12T12:02:00.000Z', contributor: 'CS Gorkem T', nextId: 10, version: 'v10' });
    expect(archived.record.archivedBy).toBe('CS Gorkem T');
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
