import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyClipboardError, writePngToClipboard } from '../src/utils/imageClipboard.js';

test('writes a PNG blob as an image clipboard item', async () => {
  const writes = [];
  class ClipboardItemMock { constructor(value) { this.value = value; } }
  const blob = new Blob(['png'], { type: 'image/png' });
  const result = await writePngToClipboard(() => Promise.resolve(blob), {
    clipboard: { write: async (items) => { await items[0].value['image/png']; writes.push(items); } }, ClipboardItem: ClipboardItemMock, isSecureContext: true,
  });
  assert.deepEqual(result, { ok: true, method: 'clipboard' });
  assert.equal(await writes[0][0].value['image/png'], blob);
});

test('starts the clipboard write before asynchronous PNG rendering', async () => {
  const sequence = [];
  class ClipboardItemMock { constructor(value) { this.value = value; } }
  const blob = new Blob(['png'], { type: 'image/png' });
  const result = await writePngToClipboard(async () => {
    sequence.push('render');
    return blob;
  }, {
    clipboard: {
      write: async (items) => {
        sequence.push('write');
        await items[0].value['image/png'];
      },
    },
    ClipboardItem: ClipboardItemMock,
    isSecureContext: true,
  });
  assert.deepEqual(result, { ok: true, method: 'clipboard' });
  assert.deepEqual(sequence, ['write', 'render']);
});

test('returns unsupported without a download fallback', async () => {
  let rendered = false;
  const result = await writePngToClipboard(() => { rendered = true; return Promise.resolve(new Blob()); }, { clipboard: null, ClipboardItem: null, isSecureContext: true });
  assert.deepEqual(result, { ok: false, method: 'failed', reason: 'unsupported' });
  assert.equal(rendered, false);
});

test('classifies failures into bounded categories', () => {
  assert.equal(classifyClipboardError({ name: 'NotAllowedError' }), 'permission');
  assert.equal(classifyClipboardError({ code: 'IMAGE_DECODE_FAILED' }), 'decode');
  assert.equal(classifyClipboardError({ code: 'IMAGE_ENCODE_FAILED' }), 'encode');
  assert.equal(classifyClipboardError(new Error('write failed')), 'write');
});
