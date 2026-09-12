import test from 'node:test';
import assert from 'node:assert/strict';

import { discoveryEvent, screenshotEvent } from '../src/domain/analyticsEvents.js';

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
