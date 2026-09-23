import { expect, test } from '@playwright/test';

const svg = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="${color}"/></svg>`;
const guide = (id, title, image) => ({ id, title, image, text: 'Example response', owner: 'Test', language: 'English', platform: 'mobile', topic: 'General' });

async function catalog(page, items) {
  await page.route('https://script.google.com/**', (route) => route.fulfill({ json: {} }));
  await page.route((url) => url.pathname === '/screenshot-library/data.json', (route) => route.fulfill({ json: items }));
  await page.goto('#/');
  await expect(page.locator('.card')).toHaveCount(items.length);
}

async function loaded(image) {
  await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
}

test('loaded gallery image opens, copies and reopens without a new editor image request', async ({ page, context }) => {
  await page.addInitScript(() => {
    window.__editorImageLoads = 0;
    window.Image = new Proxy(window.Image, { construct(target, args) {
      window.__editorImageLoads += 1;
      return Reflect.construct(target, args);
    } });
  });
  await page.route('**/test-preview.svg', async (route) => {
    await route.fulfill({ contentType: 'image/svg+xml', body: svg('#3478ab') });
  });
  await catalog(page, [guide(2, 'Cached guide', 'test-preview.svg')]);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin });
  await loaded(page.locator('.card-image'));
  for (let opening = 0; opening < 2; opening += 1) {
    await page.getByRole('button', { name: 'Inspect screenshot' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Screenshot markup canvas')).toBeVisible();
    await expect(dialog.getByLabel('Loading screenshot')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Copy Screenshot' }).click();
    await expect(dialog.getByRole('button', { name: 'Screenshot copied' })).toBeVisible();
    expect(await page.evaluate(async () => (await navigator.clipboard.read())[0].types)).toContain('image/png');
    await dialog.getByRole('button', { name: 'Close inspector' }).click();
  }
  expect(await page.evaluate(() => window.__editorImageLoads)).toBe(0);
});

test('slow editor load keeps the preview visible and ignores completion after navigation', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let corsRequests = 0;
  await page.route('https://image-fixture.test/**', async (route) => {
    const isCors = Boolean((await route.request().allHeaders()).origin);
    if (isCors && route.request().url().endsWith('/slow.svg')) {
      corsRequests += 1;
      await gate;
    }
    await route.fulfill({
      contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' },
      body: svg(route.request().url().endsWith('/slow.svg') ? '#ad3333' : '#33ad33'),
    });
  });
  try {
    await catalog(page, [
      guide(2, 'Slow guide', 'https://image-fixture.test/slow.svg'),
      guide(1, 'Next guide', 'https://image-fixture.test/next.svg'),
    ]);
    await loaded(page.locator('.card-image').first());
    await page.getByRole('button', { name: 'Inspect screenshot' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Loading screenshot')).toBeVisible();
    await loaded(dialog.getByAltText('Screenshot preview'));
    await expect(dialog.getByAltText('Screenshot preview')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Arrow', exact: true })).toBeDisabled();
    await page.screenshot({ path: test.info().outputPath('loading-preview.png') });
    await dialog.getByRole('button', { name: 'Next screenshot' }).click();
    await expect(dialog.getByRole('heading', { name: 'Next guide' })).toBeVisible();
    const canvas = dialog.getByLabel('Screenshot markup canvas');
    await expect(canvas).toBeVisible();
    const nextPixels = await canvas.evaluate((element) => element.toDataURL());
    release();
    await dialog.getByRole('button', { name: 'Previous screenshot' }).click();
    await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.evaluate((element) => element.toDataURL())).not.toBe(nextPixels);
    await dialog.getByRole('button', { name: 'Next screenshot' }).click();
    await expect.poll(() => canvas.evaluate((element) => element.toDataURL())).toBe(nextPixels);
    expect(corsRequests).toBe(1);
  } finally { release(); }
});

test('failed editor load keeps the preview and Retry recovers without closing the inspector', async ({ page }) => {
  let corsRequests = 0;
  await page.route('https://image-fixture.test/retry.svg', async (route) => {
    if ((await route.request().allHeaders()).origin) {
      corsRequests += 1;
      if (corsRequests === 1) return route.abort('failed');
    }
    return route.fulfill({ contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: svg('#3478ab') });
  });
  await catalog(page, [guide(1, 'Retry guide', 'https://image-fixture.test/retry.svg')]);
  await loaded(page.locator('.card-image'));
  // Dispatch the click directly so pointer/focus prewarming cannot consume the deliberate failure.
  await page.getByRole('button', { name: 'Inspect screenshot' }).dispatchEvent('click');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toBeVisible();
  await loaded(dialog.getByAltText('Screenshot preview'));
  await expect(dialog.getByRole('button', { name: 'Arrow', exact: true })).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath('retry-preview.png') });
  await dialog.getByRole('button', { name: 'Retry screenshot' }).click();
  await expect(dialog.getByLabel('Screenshot markup canvas')).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Arrow', exact: true })).toBeEnabled();
  expect(corsRequests).toBe(2);
});
