import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const evaluateAppsScript = (source, globals = {}) => {
  const context = vm.createContext({ ...globals });
  vm.runInContext(source, context);
  return context;
};

test('Apps Script persists the extended discovery analytics dimensions', async () => {
  const source = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  for (const header of ['Value', 'Result_Count', 'Owner', 'Content_Language', 'Response_Language', 'Content_Platform', 'Source', 'Direction']) {
    assert.match(source, new RegExp(`"${header}"`));
  }
  for (const parameter of ['params.value', 'params.resultCount', 'params.owner', 'params.contentLanguage', 'params.responseLanguage', 'params.contentPlatform', 'params.direction']) {
    assert.match(source, new RegExp(parameter.replace('.', '\\.')));
  }
  assert.match(source, /outcomeDimensions\.source/);
  for (const header of ['Record_ID', 'Owner_Key']) assert.match(source, new RegExp(`"${header}"`));
  for (const parameter of ['params.recordId', 'params.ownerKey']) assert.match(source, new RegExp(parameter.replace('.', '\\.')));
});

test('owner analytics resolves record ids before title fallback and reads owner intervals', async () => {
  const source = await readFile(new URL('../apps-script/owner-analytics.gs', import.meta.url), 'utf8');
  assert.match(source, /ownerHistory/);
  assert.match(source, /recordId/);
  assert.match(source, /ambiguous/i);
  assert.match(source, /lifetime/i);
});

test('Apps Script stores image-copy outcome dimensions', async () => {
  const source = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  for (const header of ['Edited', 'Tools_Used', 'Success', 'Failure_Reason']) assert.match(source, new RegExp(`"${header}"`));
  for (const dimension of ['edited', 'toolsUsed', 'success', 'failureReason']) {
    assert.match(source, new RegExp(`outcomeDimensions\\.${dimension}`));
    assert.match(source, new RegExp(`raw\\.${dimension}`));
  }
});

test('owner analytics separates successful image and response copies', async () => {
  const source = await readFile(new URL('../apps-script/owner-analytics.gs', import.meta.url), 'utf8');
  assert.match(source, /copy_image/);
  assert.match(source, /imageCopies/);
  assert.match(source, /editedImageCopies/);
  assert.match(source, /responseCopies/);
  assert.match(source, /cSuccess/);
});

test('response-copy components report clipboard success to Analytics', async () => {
  const card = await readFile(new URL('../src/components/ScreenshotCard.jsx', import.meta.url), 'utf8');
  const lightbox = await readFile(new URL('../src/components/Lightbox.jsx', import.meta.url), 'utf8');
  for (const source of [card, lightbox]) {
    assert.match(source, /logEvent\('copy_text',[\s\S]*success:\s*String\(successful\)/);
  }
});

test('Apps Script sanitizes image-copy dimensions but preserves unrelated event sources', async () => {
  const source = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  const context = evaluateAppsScript(source);
  const clean = JSON.parse(JSON.stringify(context.analyticsOutcomeDimensions_({
    event: 'copy_image',
    source: 'untrusted-dialog',
    edited: ' TRUE ',
    success: 'TRUE',
    toolsUsed: 'arrow,coordinates,blur,arrow,crop,number,highlight,raw-image',
    failureReason: 'raw-stack-trace',
  })));
  assert.deepEqual(clean, {
    source: 'card',
    edited: 'true',
    toolsUsed: 'arrow,blur,crop,number,highlight',
    success: 'true',
    failureReason: '',
  });

  const failed = JSON.parse(JSON.stringify(context.analyticsOutcomeDimensions_({
    event: 'copy_image', source: 'inspector', success: 'false', failureReason: 'raw-stack-trace',
  })));
  assert.equal(failed.failureReason, 'write');
  assert.equal(failed.success, 'false');

  const unrelated = JSON.parse(JSON.stringify(context.analyticsOutcomeDimensions_({
    event: 'switch_lang', source: 'keyboard-shortcut', edited: 'custom', success: 'custom',
  })));
  assert.equal(unrelated.source, 'keyboard-shortcut');
});

test('owner analytics preserves ownership intervals and excludes failed copies behaviorally', async () => {
  const source = await readFile(new URL('../apps-script/owner-analytics.gs', import.meta.url), 'utf8');
  const catalog = [{
    id: 7,
    title: 'Guide',
    owner: 'CS Enzo',
    ownerKey: 'cs-enzo',
    ownerHistory: [
      { owner: 'CS Gorkem T', ownerKey: 'cs-gorkem-t', from: null, to: '2026-06-01T00:00:00Z' },
      { owner: 'CS Enzo', ownerKey: 'cs-enzo', from: '2026-06-01T00:00:00Z', to: null },
    ],
  }];
  const logs = [
    ['Timestamp', 'Device_ID', 'Event', 'Title', 'Record_ID', 'Success', 'Edited'],
    ['2026-02-01T00:00:00Z', 'agent-a', 'copy_text', 'Guide', '7', 'true', ''],
    ['2026-03-01T00:00:00Z', 'agent-a', 'copy_text', 'Guide', '7', 'false', ''],
    ['2026-04-01T00:00:00Z', 'agent-a', 'copy_text', 'Guide', '7', '', ''],
    ['2026-07-01T00:00:00Z', 'agent-b', 'copy_text', 'Guide', '7', 'true', ''],
    ['2026-08-01T00:00:00Z', 'agent-b', 'copy_image', 'Guide', '7', 'true', 'true'],
    ['2026-09-01T00:00:00Z', 'agent-b', 'copy_image', 'Guide', '7', 'false', 'true'],
    ['2026-10-01T00:00:00Z', 'agent-b', 'copy_image', 'Guide', '7', 'true', 'false'],
  ];
  const writtenSheets = new Map();
  const createWriteSheet = (name) => ({
    clear() {},
    getRange() {
      const range = {
        setValues(values) { writtenSheets.set(name, values); return range; },
        setFontWeight() { return range; },
      };
      return range;
    },
    setFrozenRows() {},
    autoResizeColumns() {},
  });
  const sheetCache = new Map();
  const spreadsheet = {
    getSheetByName(name) {
      if (name === 'DB_Logs') return { getDataRange: () => ({ getValues: () => logs }) };
      return sheetCache.get(name) || null;
    },
    insertSheet(name) {
      const sheet = createWriteSheet(name);
      sheetCache.set(name, sheet);
      return sheet;
    },
  };
  const context = evaluateAppsScript(source, {
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(catalog) }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
  });
  const rows = JSON.parse(JSON.stringify(context.rebuildOwnerStats()));
  const byOwner = Object.fromEntries(rows.map((row) => [row.owner, row]));

  assert.deepEqual(
    { total: byOwner['CS Gorkem T'].total, copies: byOwner['CS Gorkem T'].copies, responseCopies: byOwner['CS Gorkem T'].responseCopies, imageCopies: byOwner['CS Gorkem T'].imageCopies },
    { total: 2, copies: 2, responseCopies: 2, imageCopies: 0 },
  );
  assert.deepEqual(
    { total: byOwner['CS Enzo'].total, copies: byOwner['CS Enzo'].copies, responseCopies: byOwner['CS Enzo'].responseCopies, imageCopies: byOwner['CS Enzo'].imageCopies, editedImageCopies: byOwner['CS Enzo'].editedImageCopies },
    { total: 3, copies: 1, responseCopies: 1, imageCopies: 2, editedImageCopies: 1 },
  );
  assert.deepEqual(
    { responseCopies: byOwner['CS Enzo'].items[0].responseCopies, imageCopies: byOwner['CS Enzo'].items[0].imageCopies, editedImageCopies: byOwner['CS Enzo'].items[0].editedImageCopies },
    { responseCopies: 1, imageCopies: 2, editedImageCopies: 1 },
  );
  assert.equal(writtenSheets.has('Owner'), true);
  assert.equal(writtenSheets.has('Owner Details'), true);
});
