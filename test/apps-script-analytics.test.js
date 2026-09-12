import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Apps Script persists the extended discovery analytics dimensions', async () => {
  const source = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  for (const header of ['Value', 'Result_Count', 'Owner', 'Content_Language', 'Response_Language', 'Content_Platform', 'Source', 'Direction']) {
    assert.match(source, new RegExp(`"${header}"`));
  }
  for (const parameter of ['params.value', 'params.resultCount', 'params.owner', 'params.contentLanguage', 'params.responseLanguage', 'params.contentPlatform', 'params.source', 'params.direction']) {
    assert.match(source, new RegExp(parameter.replace('.', '\\.')));
  }
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
