import test from 'node:test';
import assert from 'node:assert/strict';

import { discoveryEvent, imageCopyEvent, screenshotEvent } from '../src/domain/analyticsEvents.js';

test('screenshotEvent includes stable analysis dimensions', () => {
  assert.deepEqual(
    screenshotEvent({
      id: 42,
      title: 'Guide',
      topic: 'LOAN',
      language: 'English',
      owner: 'CS Gorkem T',
      ownerKey: 'cs-gorkem-t',
      platform: 'mobile',
    }, { source: 'card' }),
    {
      title: 'Guide',
      recordId: '42',
      topic: 'LOAN',
      contentLanguage: 'English',
      owner: 'CS Gorkem T',
      ownerKey: 'cs-gorkem-t',
      contentPlatform: 'mobile',
      source: 'card',
    },
  );
});

test('screenshotEvent normalizes missing and legacy platform fields', () => {
  assert.deepEqual(screenshotEvent({ title: 'Legacy' }), {
    title: 'Legacy',
    recordId: '',
    topic: '',
    contentLanguage: '',
    owner: '',
    ownerKey: '',
    contentPlatform: 'mobile',
  });
});

test('discoveryEvent records selection and result count', () => {
  assert.deepEqual(discoveryEvent('Futures', 12), { value: 'Futures', resultCount: 12 });
  assert.deepEqual(discoveryEvent('', Number.NaN), { value: '', resultCount: 0 });
});

test('imageCopyEvent includes bounded outcome data without markup geometry', () => {
  const payload = imageCopyEvent(
    { id: 42, title: 'Guide', topic: 'LOAN', language: 'English', owner: 'CS Gorkem T', ownerKey: 'cs-gorkem-t', platform: 'mobile' },
    { source: 'inspector', ok: true, edited: true, toolsUsed: ['arrow', 'blur', 'arrow'] },
  );
  assert.deepEqual(payload, {
    title: 'Guide', recordId: '42', topic: 'LOAN', contentLanguage: 'English', owner: 'CS Gorkem T', ownerKey: 'cs-gorkem-t',
    contentPlatform: 'mobile', source: 'inspector', method: 'clipboard', success: 'true', edited: 'true', toolsUsed: 'arrow,blur', failureReason: '',
  });
  assert.equal(JSON.stringify(payload).includes('coordinates'), false);
});

test('imageCopyEvent records a bounded failure category', () => {
  const payload = imageCopyEvent({ title: 'Guide' }, { source: 'card', ok: false, reason: 'permission' });
  assert.equal(payload.method, 'failed');
  assert.equal(payload.success, 'false');
  assert.equal(payload.failureReason, 'permission');
  assert.equal(payload.edited, 'false');
});

test('imageCopyEvent allowlists its source and markup tools', () => {
  const payload = imageCopyEvent({ title: 'Guide' }, {
    source: 'untrusted-dialog',
    ok: true,
    edited: true,
    toolsUsed: ['arrow', 'coordinates', 'blur', 'arrow', 'crop', 'number', 'highlight', 'raw-image'],
  });
  assert.equal(payload.source, 'card');
  assert.equal(payload.toolsUsed, 'arrow,blur,crop,number,highlight');
  assert.equal(payload.failureReason, '');
});
