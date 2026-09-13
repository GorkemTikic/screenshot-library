import { createMarkupSession } from '../domain/markup.js';
import { renderMarkupPng } from './markupRenderer.js';

export function classifyClipboardError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'permission';
  if (error?.code === 'IMAGE_DECODE_FAILED') return 'decode';
  if (error?.code === 'IMAGE_ENCODE_FAILED') return 'encode';
  return 'write';
}

export async function writePngToClipboard(createBlob, environment = {}) {
  const clipboard = environment.clipboard ?? globalThis.navigator?.clipboard;
  const ClipboardItemClass = environment.ClipboardItem ?? globalThis.ClipboardItem;
  const secure = environment.isSecureContext ?? globalThis.isSecureContext;

  if (!secure || !clipboard?.write || !ClipboardItemClass) {
    return { ok: false, method: 'failed', reason: 'unsupported' };
  }

  try {
    const blobPromise = Promise.resolve().then(createBlob);
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
  }, options.environment);
}
