import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';

const bundled = JSON.parse(readFileSync(new URL('../src/data/data.json', import.meta.url), 'utf8'));
const seed = { ...bundled[0], id: 1, title: 'Existing guide', topic: 'General', platform: 'mobile' };

async function mockCatalog(page, initial = [seed]) {
    let items = structuredClone(initial);
    const published = [];
    await page.addInitScript(() => sessionStorage.setItem('fdsl_session_v1', 'local-test-session'));
    await page.route('https://script.google.com/**', (route) => route.fulfill({ status: 200, body: '{}' }));
    await page.route(/\/screenshot-library\/data\.json\?/, (route) => route.fulfill({ json: items }));
    await page.route('**/__test_api__/**', async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (path.endsWith('/auth/me')) return route.fulfill({ json: { principal: { id: 'test', displayName: 'Test Contributor', role: 'contributor' } } });
        if (path.endsWith('/content') && request.method() === 'GET') return route.fulfill({ json: { items } });
        if (['POST', 'PATCH'].includes(request.method()) && path.includes('/content')) {
            const body = new globalThis.Request(request.url(), { method: request.method(), headers: request.headers(), body: request.postDataBuffer() });
            const payload = request.headers()['content-type'].includes('multipart/form-data')
                ? JSON.parse((await body.formData()).get('payload')) : await body.json();
            published.push(payload);
            const previous = items.find((item) => item.id === payload.recordId);
            const record = { ...(previous || seed), ...payload.patch, id: previous?.id || 100, version: `v${published.length}` };
            items = [record, ...items.filter((item) => item.id !== record.id)];
            return route.fulfill({ json: { record } });
        }
        return route.fulfill({ json: {} });
    });
    return published;
}

async function openNew(page) {
    await page.goto('#/admin');
    await page.getByRole('button', { name: 'Create new', exact: true }).click();
    return page.getByRole('dialog', { name: 'Create screenshot guide' });
}

test('publishing a new category makes it filterable and reusable after reload', async ({ page }) => {
    const published = await mockCatalog(page);
    const dialog = await openNew(page);
    await dialog.getByLabel('Title *', { exact: true }).fill('New spot guide');
    await dialog.getByLabel('Source response *', { exact: true }).fill('Follow these steps.');
    await dialog.locator('input[type=file]').setInputFiles({ name: 'guide.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=', 'base64') });
    await dialog.getByLabel('Topic *', { exact: true }).selectOption('');
    await dialog.getByLabel('New category name *', { exact: true }).fill('  Spot   Trading  ');
    await dialog.getByRole('button', { name: 'Publish new screenshot', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(published[0].patch.topic).toBe('Spot Trading');
    await page.goto('#/');
    await page.reload();
    await page.getByRole('button', { name: 'Spot Trading 1 guides', exact: true }).click();
    await expect(page.locator('.card-title')).toHaveText(['New spot guide']);
    const next = await openNew(page);
    await expect(next.getByLabel('Topic *', { exact: true }).getByRole('option', { name: 'Spot Trading', exact: true })).toHaveCount(1);
});

test('case and space variants reuse existing categories when editing', async ({ page }) => {
    const published = await mockCatalog(page, [seed, { ...seed, id: 2, title: 'Spot guide', topic: 'Spot Trading' }]);
    await page.goto('#/admin');
    await page.getByRole('button', { name: 'Replace or edit Existing guide', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Replace image or edit guide' });
    await dialog.getByLabel('Topic *', { exact: true }).selectOption('');
    await dialog.getByLabel('New category name *', { exact: true }).fill(' spot  TRADING ');
    await expect(dialog.getByText('Existing category “Spot Trading” will be reused.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish changes', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(published[0].patch.topic).toBe('Spot Trading');
    await page.goto('#/');
    await page.getByRole('button', { name: 'Spot Trading 2 guides', exact: true }).click();
    await expect(page.locator('.card-title')).toHaveCount(2);
});

test('blank and reserved categories cannot publish; cancelling does not create a category', async ({ page }) => {
    const published = await mockCatalog(page);
    const dialog = await openNew(page);
    await dialog.getByLabel('Topic *', { exact: true }).selectOption('');
    await dialog.getByRole('button', { name: 'Publish new screenshot', exact: true }).click();
    await expect(dialog.getByText('Enter a category name.', { exact: true })).toBeVisible();
    await dialog.getByLabel('New category name *', { exact: true }).fill(' All ');
    await dialog.getByRole('button', { name: 'Publish new screenshot', exact: true }).click();
    await expect(dialog.getByText(/reserved for the library filter/)).toBeVisible();
    await dialog.getByLabel('New category name *', { exact: true }).fill('Unpublished category');
    page.once('dialog', (confirmation) => confirmation.accept());
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    const next = await openNew(page);
    await expect(next.getByLabel('Topic *', { exact: true }).getByRole('option', { name: 'Unpublished category', exact: true })).toHaveCount(0);
    expect(published).toEqual([]);
});
