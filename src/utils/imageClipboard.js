import { createMarkupSession } from '../domain/markup.js';
import { renderMarkupPng } from './markupRenderer.js';

export function classifyClipboardError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'permission';
  if (error?.code === 'IMAGE_DECODE_FAILED') return 'decode';
  if (error?.code === 'IMAGE_ENCODE_FAILED') return 'encode';
  return 'write';
}

function abortError() {
  if (typeof DOMException === 'function') return new DOMException('Screenshot copy cancelled', 'AbortError');
  return Object.assign(new Error('Screenshot copy cancelled'), { name: 'AbortError' });
}

function abortableBlob(createBlob, signal) {
  if (!signal) return Promise.resolve().then(createBlob);
  if (signal.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });

    Promise.resolve()
      .then(() => {
        if (signal.aborted) throw abortError();
        return createBlob();
      })
      .then((blob) => {
        if (signal.aborted) throw abortError();
        resolve(blob);
      })
      .catch(reject)
      .finally(() => signal.removeEventListener('abort', onAbort));
  });
}

export async function writePngToClipboard(createBlob, environment = {}) {
  const clipboard = environment.clipboard ?? globalThis.navigator?.clipboard;
  const ClipboardItemClass = environment.ClipboardItem ?? globalThis.ClipboardItem;
  const secure = environment.isSecureContext ?? globalThis.isSecureContext;

  if (!secure || !clipboard?.write || !ClipboardItemClass) {
    return { ok: false, method: 'failed', reason: 'unsupported' };
  }

  try {
    const blobPromise = abortableBlob(createBlob, environment.signal);
    await clipboard.write([new ClipboardItemClass({ 'image/png': blobPromise })]);
    return { ok: true, method: 'clipboard' };
  } catch (error) {
    return { ok: false, method: 'failed', reason: classifyClipboardError(error) };
  }
}

export async function loadScreenshotImage(url, environment = {}) {
  const ImageClass = environment.Image ?? globalThis.Image;
  if (!ImageClass) {
    throw Object.assign(new Error('Image decoding is unavailable'), { code: 'IMAGE_DECODE_FAILED' });
  }

  return new Promise((resolve, reject) => {
    const image = new ImageClass();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(Object.assign(
      new Error('Screenshot could not be decoded'),
      { code: 'IMAGE_DECODE_FAILED' },
    ));
    image.src = url;
  });
}

export async function copyScreenshot(url, options = {}) {
  const render = options.render || renderMarkupPng;
  return writePngToClipboard(async () => {
    const image = options.image || await loadScreenshotImage(url, options.environment);
    return render(image, options.session || createMarkupSession(), options.environment?.document);
  }, { ...options.environment, signal: options.signal });
}
