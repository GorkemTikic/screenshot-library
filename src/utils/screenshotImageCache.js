const decodeError = () => Object.assign(new Error('Screenshot could not be decoded'), { code: 'IMAGE_DECODE_FAILED' });

function imageKey(url) {
  try { return new URL(url, globalThis.document?.baseURI).href; }
  catch { return url; }
}

// Keep only a small LRU of source images, never edited canvases or exported PNGs.
export function createScreenshotImageCache(maxEntries = 12) {
  const caches = new WeakMap();
  const entriesFor = (ImageClass) => {
    if (!caches.has(ImageClass)) caches.set(ImageClass, new Map());
    return caches.get(ImageClass);
  };
  const retain = (entries, key, entry) => {
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    return entry.promise;
  };
  const matches = (image, key) => image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0
    && imageKey(image.src) === key && imageKey(image.currentSrc || image.src) === key;

  return {
    load(url, environment = {}) {
      const ImageClass = environment.Image ?? globalThis.Image;
      if (!ImageClass || !url) return Promise.reject(decodeError());
      const entries = entriesFor(ImageClass);
      const key = imageKey(url);
      const cached = entries.get(key);
      if (cached && (!cached.galleryImage || matches(cached.galleryImage, key))) {
        return retain(entries, key, cached);
      }

      const promise = new Promise((resolve, reject) => {
        const image = new ImageClass();
        const finish = (error) => {
          clearTimeout(timeout);
          image.onload = null;
          image.onerror = null;
          if (error) reject(error);
          else resolve(image);
        };
        const timeout = setTimeout(() => finish(decodeError()), 20_000);
        timeout.unref?.();
        image.crossOrigin = 'anonymous';
        image.onload = () => finish();
        image.onerror = () => finish(decodeError());
        image.src = url;
      });
      const entry = { promise };
      retain(entries, key, entry);
      // A failed request must not poison subsequent retries, or remove a newer entry.
      void promise.catch(() => {
        if (entries.get(key) === entry) entries.delete(key);
      });
      return promise;
    },

    remember(url, image, environment = {}) {
      const ImageClass = environment.Image ?? globalThis.Image;
      if (!ImageClass) return false;
      const key = imageKey(url);
      if (!matches(image, key)) return false;
      // Plain gallery images may be cross-origin (including redirects). Probe
      // exportability before sharing them with the editor or clipboard canvas.
      try {
        const canvas = (image.ownerDocument || globalThis.document).createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, 1, 1);
        context.getImageData(0, 0, 1, 1);
      } catch { return false; }
      retain(entriesFor(ImageClass), key, { promise: Promise.resolve(image), galleryImage: image });
      return true;
    },
  };
}

const screenshotImages = createScreenshotImageCache();
export const loadScreenshotImage = screenshotImages.load;
export const rememberScreenshotImage = screenshotImages.remember;
