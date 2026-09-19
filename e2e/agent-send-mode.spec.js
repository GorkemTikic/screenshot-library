import { expect, test } from '@playwright/test';

const KNOWN_TRANSLATED_GUIDE = 'Futures Grid Bot Trade/Transaction History - EN';
const APP_ORIGIN = 'http://127.0.0.1:5173';

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP_ORIGIN });
  await page.goto('#/');
  await expect(page.locator('.card').first()).toBeVisible();
});

function translatedCard(page) {
  return page.locator('.card').filter({
    has: page.getByRole('heading', { name: KNOWN_TRANSLATED_GUIDE, exact: true }),
  });
}

async function waitForCardImage(card) {
  const image = card.locator('img.card-image');
  await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
  return image;
}

async function openTranslatedGuide(page) {
  const card = translatedCard(page);
  await expect(card).toHaveCount(1);
  await waitForCardImage(card);
  await card.locator('.card-image-wrapper').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Arrow' })).toBeEnabled();
  return { card, dialog, canvas: dialog.getByLabel('Screenshot markup canvas') };
}

async function dragAcross(page, canvas, from, to) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Markup canvas has no visible bounds');
  await page.mouse.move(box.x + box.width * from.x, box.y + box.height * from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to.x, box.y + box.height * to.y, { steps: 5 });
  await page.mouse.up();
}

async function canvasSnapshot(canvas) {
  return canvas.evaluate((element) => element.toDataURL('image/png'));
}

async function expectCanvasToChange(canvas, previous) {
  await expect.poll(() => canvasSnapshot(canvas)).not.toBe(previous);
  return canvasSnapshot(canvas);
}

async function sourceImageDimensions(image) {
  return image.evaluate((element) => ({
    src: element.currentSrc || element.src,
    width: element.naturalWidth,
    height: element.naturalHeight,
  }));
}

async function clipboardPng(page) {
  return page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const pngItem = items.find((item) => item.types.includes('image/png'));
    if (!pngItem) return { type: '', width: 0, height: 0, types: items.flatMap((item) => item.types) };
    const blob = await pngItem.getType('image/png');
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const digest = await crypto.subtle.digest('SHA-256', pixels);
    const pixelHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const result = {
      type: blob.type, width: bitmap.width, height: bitmap.height, types: pngItem.types, pixelHash,
    };
    bitmap.close();
    return result;
  });
}

const normalizedLines = (value) => String(value || '').replace(/\r\n/g, '\n');

async function knownGuideContent(page) {
  return page.evaluate(async (title) => {
    const response = await fetch('/screenshot-library/data.json');
    const catalog = await response.json();
    const guide = catalog.find((item) => item.title === title);
    return { text: guide?.text || '', textTr: guide?.text_tr || '' };
  }, KNOWN_TRANSLATED_GUIDE);
}

test('card copies image/png while response copy remains available', async ({ page }) => {
  const card = translatedCard(page);
  await expect(card).toHaveCount(1);
  const image = await waitForCardImage(card);
  const source = await sourceImageDimensions(image);
  const screenshotCopy = card.getByRole('button', { name: 'Copy Screenshot' });
  const responseCopy = card.getByRole('button', { name: 'Copy EN' });

  await expect(screenshotCopy).toBeVisible();
  await expect(responseCopy).toBeVisible();
  await screenshotCopy.click();
  await expect(card.getByRole('button', { name: 'Screenshot copied' })).toBeVisible();

  const clipboard = await clipboardPng(page);
  expect(clipboard.types).toContain('image/png');
  expect(clipboard).toMatchObject({ type: 'image/png', width: source.width, height: source.height });
  expect(clipboard.pixelHash).toMatch(/^[a-f0-9]{64}$/);

  const expected = await knownGuideContent(page);
  await responseCopy.click();
  await expect.poll(async () => normalizedLines(await page.evaluate(() => navigator.clipboard.readText())))
    .toBe(normalizedLines(expected.text));
  await card.getByRole('button', { name: 'TR', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Copy TR' })).toBeVisible({ timeout: 3_000 });
  await card.getByRole('button', { name: 'Copy TR' }).click();
  await expect.poll(async () => normalizedLines(await page.evaluate(() => navigator.clipboard.readText())))
    .toBe(normalizedLines(expected.textTr));
  await expect(card.locator('.btn-screenshot-copy')).toBeVisible();
});

test('quick markup exports changed pixels, resets cleanly, and supports undo and redo', async ({ page }) => {
  const card = translatedCard(page);
  const image = await waitForCardImage(card);
  const source = await sourceImageDimensions(image);
  await card.getByRole('button', { name: 'Copy Screenshot' }).click();
  await expect(card.getByRole('button', { name: 'Screenshot copied' })).toBeVisible();
  const cleanClipboard = await clipboardPng(page);
  const { dialog, canvas } = await openTranslatedGuide(page);
  const clean = await canvasSnapshot(canvas);

  await dialog.getByRole('button', { name: 'Arrow' }).click();
  await dragAcross(page, canvas, { x: 0.18, y: 0.26 }, { x: 0.72, y: 0.66 });
  const arrow = await expectCanvasToChange(canvas, clean);

  await dialog.getByRole('button', { name: 'Number' }).click();
  const canvasBox = await canvas.boundingBox();
  await canvas.click({ position: { x: canvasBox.width * 0.35, y: canvasBox.height * 0.28 } });
  const numbered = await expectCanvasToChange(canvas, arrow);

  await dialog.getByRole('button', { name: 'Highlight' }).click();
  await dragAcross(page, canvas, { x: 0.12, y: 0.13 }, { x: 0.48, y: 0.34 });
  const highlighted = await expectCanvasToChange(canvas, numbered);

  await dialog.getByRole('button', { name: 'Blur' }).click();
  await dragAcross(page, canvas, { x: 0.54, y: 0.18 }, { x: 0.84, y: 0.42 });
  const blurred = await expectCanvasToChange(canvas, highlighted);

  await dialog.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => canvasSnapshot(canvas)).toBe(highlighted);
  await expect(dialog.getByRole('button', { name: 'Redo' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Redo' }).click();
  await expect.poll(() => canvasSnapshot(canvas)).toBe(blurred);

  await dialog.getByRole('button', { name: 'Copy Screenshot' }).click();
  await expect(dialog.getByRole('button', { name: 'Screenshot copied' })).toBeVisible();
  const editedClipboard = await clipboardPng(page);
  expect(editedClipboard).toMatchObject({ type: 'image/png', width: source.width, height: source.height });
  expect(editedClipboard.pixelHash).not.toBe(cleanClipboard.pixelHash);

  page.once('dialog', (confirmation) => confirmation.accept());
  await dialog.getByRole('button', { name: 'Reset' }).click();
  await expect.poll(() => canvasSnapshot(canvas)).toBe(clean);
  await expect(dialog.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Reset' })).toBeDisabled();

  await dialog.locator('.btn-screenshot-copy').click();
  await expect(dialog.getByRole('button', { name: 'Screenshot copied' })).toBeVisible();
  const resetClipboard = await clipboardPng(page);
  expect(resetClipboard).toMatchObject({ type: 'image/png', width: source.width, height: source.height });
  expect(resetClipboard.pixelHash).toBe(cleanClipboard.pixelHash);
});

test('crop changes clipboard dimensions and markup resets across navigation and reopen', async ({ page }) => {
  const card = translatedCard(page);
  const image = await waitForCardImage(card);
  const source = await sourceImageDimensions(image);
  const { dialog, canvas } = await openTranslatedGuide(page);

  await dialog.getByRole('button', { name: 'Crop' }).click();
  await dragAcross(page, canvas, { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.75 });
  await expect(dialog.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Copy Screenshot' }).click();
  await expect(dialog.getByRole('button', { name: 'Screenshot copied' })).toBeVisible();

  const cropped = await clipboardPng(page);
  expect(cropped.type).toBe('image/png');
  expect(cropped.width / source.width).toBeCloseTo(0.6, 1);
  expect(cropped.height / source.height).toBeCloseTo(0.55, 1);

  await dialog.getByRole('button', { name: 'Next screenshot' }).click();
  await expect(dialog.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Previous screenshot' }).click();
  await expect(dialog.getByRole('heading', { name: KNOWN_TRANSLATED_GUIDE, exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Undo' })).toBeDisabled();

  await dialog.getByRole('button', { name: 'Close inspector' }).click();
  await translatedCard(page).locator('.card-image-wrapper').click();
  const reopened = page.getByRole('dialog');
  await expect(reopened.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(reopened.getByRole('button', { name: 'Reset' })).toBeDisabled();
});

test('EN and TR response copy remain independent from screenshot copy', async ({ page }) => {
  const { dialog } = await openTranslatedGuide(page);
  const response = dialog.locator('.inspector-response');
  const english = await response.textContent();

  await dialog.getByRole('button', { name: 'TR', exact: true }).click();
  await expect(response).not.toHaveText(english);
  const turkish = await response.textContent();
  await expect(dialog.getByRole('button', { name: 'Copy Screenshot' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Copy TR' }).click();
  await expect.poll(async () => normalizedLines(await page.evaluate(() => navigator.clipboard.readText())))
    .toBe(normalizedLines(turkish));

  await dialog.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(response).toHaveText(english);
  await expect(dialog.getByRole('button', { name: 'Copy EN' })).toBeVisible({ timeout: 3_000 });
  await dialog.getByRole('button', { name: 'Copy EN' }).click();
  await expect.poll(async () => normalizedLines(await page.evaluate(() => navigator.clipboard.readText())))
    .toBe(normalizedLines(english));
});

test('focus and Escape cancel an active gesture before closing the inspector', async ({ page }) => {
  const { dialog, canvas } = await openTranslatedGuide(page);
  await expect(dialog.getByRole('button', { name: 'Close inspector' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Arrow' }).click();
  await canvas.focus();

  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.7, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.mouse.up();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('search, platform filters, favorites, and inspector navigation remain intact', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search title, response, topic or owner…' });
  await search.fill(KNOWN_TRANSLATED_GUIDE);
  await expect(translatedCard(page)).toBeVisible();

  await page.getByRole('button', { name: 'Web', exact: true }).click();
  await expect(translatedCard(page)).toBeHidden();
  await page.getByRole('button', { name: 'Mobile', exact: true }).click();
  const card = translatedCard(page);
  await expect(card).toBeVisible();

  await card.getByRole('button', { name: 'Add to favorites' }).click();
  const favoritesFilter = page.locator('.filter-btn').filter({ hasText: 'Favorites' });
  await favoritesFilter.click();
  await expect(card).toBeVisible();
  await expect(favoritesFilter).toHaveAttribute('aria-pressed', 'true');

  await card.getByRole('button', { name: 'Inspect screenshot' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: KNOWN_TRANSLATED_GUIDE, exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close inspector' }).click();
  await expect(card).toBeVisible();
});

test('mobile inspector actions stay scrollable and reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { dialog } = await openTranslatedGuide(page);
  const panel = dialog.locator('.inspector-panel');
  const actions = dialog.locator('.inspector-actions');

  await expect(panel).toHaveCSS('overflow-y', 'auto');
  await actions.scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', { name: 'Copy Screenshot' })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Copy EN' })).toBeInViewport();
  await expect(dialog.getByRole('link', { name: 'Open image' })).toBeInViewport();
  const scrollState = await panel.evaluate((element) => ({
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(scrollState.scrollHeight).toBeGreaterThanOrEqual(scrollState.clientHeight);
  if (scrollState.scrollHeight > scrollState.clientHeight) expect(scrollState.scrollTop).toBeGreaterThan(0);
});

test('short landscape keeps markup and send actions usable with top-aligned copy controls', async ({ page }) => {
  const { dialog, canvas } = await openTranslatedGuide(page);
  await page.setViewportSize({ width: 667, height: 320 });
  const panel = dialog.locator('.inspector-panel');
  const actions = dialog.locator('.inspector-actions');
  const screenshotCopy = dialog.getByRole('button', { name: 'Copy Screenshot' });
  const responseCopy = dialog.getByRole('button', { name: 'Copy EN' });

  await expect(dialog.getByRole('toolbar', { name: 'Quick Markup' })).toBeInViewport();
  await expect(canvas).toBeInViewport();
  await expect(panel).toHaveCSS('overflow-y', 'auto');
  await actions.scrollIntoViewIfNeeded();
  await expect(screenshotCopy).toBeInViewport();
  await expect(responseCopy).toBeInViewport();

  const tops = await Promise.all([
    screenshotCopy.evaluate((element) => element.getBoundingClientRect().top),
    responseCopy.evaluate((element) => element.getBoundingClientRect().top),
  ]);
  expect(Math.abs(tops[0] - tops[1])).toBeLessThanOrEqual(2);
});

test.describe('touch-capable markup', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('a touch tap places a numbered marker through the pointer path', async ({ page }) => {
    const { dialog, canvas } = await openTranslatedGuide(page);
    const clean = await canvasSnapshot(canvas);
    await dialog.getByRole('button', { name: 'Number' }).click();
    const box = await canvas.boundingBox();
    await page.touchscreen.tap(box.x + box.width * 0.42, box.y + box.height * 0.36);
    await expectCanvasToChange(canvas, clean);
    await expect(dialog.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });
});
