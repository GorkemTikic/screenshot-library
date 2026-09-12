import test from 'node:test';
import assert from 'node:assert/strict';

import { discoveryEvent, screenshotEvent } from '../src/domain/analyticsEvents.js';

test('screenshotEvent includes stable analysis dimensions', () => {
  assert.deepEqual(
    screenshotEvent({
      title: 'Guide',
      topic: 'LOAN',
      language: 'English',
      owner: 'CS Gorkem T',
      platform: 'mobile',
    }, { source: 'card' }),
    {
      title: 'Guide',
      topic: 'LOAN',
      contentLanguage: 'English',
      owner: 'CS Gorkem T',
      contentPlatform: 'mobile',
      source: 'card',
    },
  );
});

test('screenshotEvent normalizes missing and legacy platform fields', () => {
  assert.deepEqual(screenshotEvent({ title: 'Legacy' }), {
    title: 'Legacy',
    topic: '',
    contentLanguage: '',
    owner: '',
    contentPlatform: 'mobile',
  });
});

test('discoveryEvent records selection and result count', () => {
  assert.deepEqual(discoveryEvent('Futures', 12), { value: 'Futures', resultCount: 12 });
  assert.deepEqual(discoveryEvent('', Number.NaN), { value: '', resultCount: 0 });
});
