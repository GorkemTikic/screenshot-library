import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../src/data/data.json', import.meta.url), 'utf8'));
const mobile = catalog.filter((item) => !item.archivedAt && item.platform !== 'web');
const fundingTitles = mobile.filter((item) => /funding/i.test(item.title)).map((item) => item.title);

test.beforeEach(async ({ page }) => {
    // Keep these read-only checks out of production analytics.
    await page.route('https://script.google.com/**', (route) => route.fulfill({ status: 200, body: '{}' }));
    await page.goto('#/');
    await expect(page.locator('.card-title')).toHaveCount(mobile.length);
});

test('Funding prioritizes all title variants and preserves English and Chinese filters', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.getByRole('searchbox').fill('Funding');
    const headings = page.locator('.card-title');
    await expect.poll(async () => (await headings.allTextContents()).slice(0, fundingTitles.length).sort())
        .toEqual([...fundingTitles].sort());
    await expect(page.getByRole('heading', { name: 'Close Open Position on Stopped Grid - EN', exact: true })).toHaveCount(0);

    for (const language of ['English', 'Chinese', 'Arabic']) {
        await page.getByLabel('Language', { exact: true }).selectOption(language);
        const expected = mobile.filter((item) => item.language === language && /funding/i.test(item.title)).map((item) => item.title);
        await expect.poll(async () => (await headings.allTextContents()).slice(0, expected.length).sort())
            .toEqual(expected.sort());
    }
    expect(errors).toEqual([]);
});

test('multiword and typo searches work and clearing restores browsing order', async ({ page }) => {
    const search = page.getByRole('searchbox');
    await page.getByLabel('Language', { exact: true }).selectOption('English');
    for (const query of ['history funding', 'funding hist', 'fundng history']) {
        await search.fill(query);
        await expect(page.locator('.card-title').first()).toHaveText('Funding Fee History - EN');
    }
    await search.fill('TP SL Funding');
    await expect(page.locator('.card-title').first()).toHaveText('Futures Notification for TP/SL/Funding - EN');
    await search.fill('zzzzzzzzz');
    await expect(page.getByText('No matching screenshot', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByLabel('Language', { exact: true })).toHaveValue('All');
    await expect(page.locator('.card-title')).toHaveText([...mobile].sort((a, b) => Number(b.id) - Number(a.id)).map((item) => item.title));
});
