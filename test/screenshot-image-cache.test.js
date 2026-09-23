import test from 'node:test';
import assert from 'node:assert/strict';
import { createScreenshotImageCache } from '../src/utils/screenshotImageCache.js';

function fixture(maxEntries = 12) {
  const images = [];
  class ImageMock { constructor() { images.push(this); } }
  return { cache: createScreenshotImageCache(maxEntries), images, environment: { Image: ImageMock } };
}

test('concurrent editor and copy loads share a request, and reopening reuses the image', async () => {
  const { cache, images, environment } = fixture();
  const first = cache.load('/a.png', environment);
  const second = cache.load('/a.png', environment);
  assert.equal(images.length, 1);
  assert.equal(images[0].crossOrigin, 'anonymous');
  images[0].onload();
  assert.equal(await first, await second);
  assert.equal(await cache.load('/a.png', environment), images[0]);
  assert.equal(images.length, 1);
});

test('failed requests are evicted so retry performs a fresh load', async () => {
  const { cache, images, environment } = fixture();
  const failed = cache.load('/a.png', environment);
  images[0].onerror();
  await assert.rejects(failed, { code: 'IMAGE_DECODE_FAILED' });
  const retry = cache.load('/a.png', environment);
  assert.equal(images.length, 2);
  images[1].onload();
  assert.equal(await retry, images[1]);
});

test('a stalled image times out and can be retried', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const { cache, images, environment } = fixture();
  const stalled = cache.load('/stalled.png', environment);
  context.mock.timers.tick(20_000);
  await assert.rejects(stalled, { code: 'IMAGE_DECODE_FAILED' });
  const retry = cache.load('/stalled.png', environment);
  assert.equal(images.length, 2);
  images[1].onload();
  assert.equal(await retry, images[1]);
});

test('an evicted pending failure cannot remove a newer successful request for the same URL', async () => {
  const { cache, images, environment } = fixture(1);
  const old = cache.load('/a.png', environment);
  const other = cache.load('/b.png', environment);
  images[1].onload();
  await other;
  const latest = cache.load('/a.png', environment);
  images[2].onload();
  await latest;
  images[0].onerror();
  await assert.rejects(old, { code: 'IMAGE_DECODE_FAILED' });
  assert.equal(await cache.load('/a.png', environment), images[2]);
  assert.equal(images.length, 3);
});

test('the least recently used image is released when the cache fills', async () => {
  const { cache, images, environment } = fixture(2);
  for (const url of ['/a.png', '/b.png']) {
    const loading = cache.load(url, environment);
    images.at(-1).onload();
    await loading;
  }
  await cache.load('/a.png', environment);
  const third = cache.load('/c.png', environment);
  images.at(-1).onload();
  await third;
  await cache.load('/a.png', environment);
  assert.equal(images.length, 3);
  const evicted = cache.load('/b.png', environment);
  assert.equal(images.length, 4);
  images.at(-1).onload();
  await evicted;
});

test('a loaded gallery image is reused only after verifying canvas export is allowed', async () => {
  const { cache, images, environment } = fixture();
  let tainted = false;
  const image = {
    complete: true, naturalWidth: 100, naturalHeight: 50, src: '/a.png',
    ownerDocument: {
      createElement: () => ({ getContext: () => ({
        drawImage() {}, getImageData() { if (tainted) throw new Error('SecurityError'); },
      }) }),
    },
  };
  assert.equal(cache.remember('/a.png', image, environment), true);
  assert.equal(await cache.load('/a.png', environment), image);
  assert.equal(images.length, 0);
  tainted = true;
  assert.equal(cache.remember('/b.png', { ...image, src: '/b.png' }, environment), false);
  assert.equal(cache.remember('/wrong.png', image, environment), false);
  assert.equal(cache.remember('/a.png', { ...image, complete: false }, environment), false);
  // React can reuse the gallery DOM node when a record's image is replaced.
  image.src = '/replacement.png';
  const original = cache.load('/a.png', environment);
  assert.equal(images.length, 1, 'a reused DOM node must not return the wrong screenshot');
  images[0].onload();
  assert.equal(await original, images[0]);
});
