import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUICK_MARKUP_DISCOVERED_KEY,
  isQuickMarkupDiscovered,
  markQuickMarkupDiscovered,
  shouldShowQuickMarkupTip,
} from '../src/domain/quickMarkupDiscovery.js';

function memoryStorage(seed = {}) {
  const data = { ...seed };
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; },
    _data: data,
  };
}

test('shows the tip when not discovered and not soft-dismissed', () => {
  assert.equal(shouldShowQuickMarkupTip({ discovered: false, softDismissed: false }), true);
});

test('soft dismiss hides the tip without marking discovery', () => {
  assert.equal(shouldShowQuickMarkupTip({ discovered: false, softDismissed: true }), false);
  const storage = memoryStorage();
  assert.equal(isQuickMarkupDiscovered(storage), false);
});

test('discovery permanently hides the tip', () => {
  const storage = memoryStorage();
  assert.equal(markQuickMarkupDiscovered(storage), true);
  assert.equal(storage.getItem(QUICK_MARKUP_DISCOVERED_KEY), '1');
  assert.equal(isQuickMarkupDiscovered(storage), true);
  assert.equal(shouldShowQuickMarkupTip({ discovered: true, softDismissed: false }), false);
});

test('marking discovery is resilient when storage throws', () => {
  const storage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  assert.equal(isQuickMarkupDiscovered(storage), false);
  assert.equal(markQuickMarkupDiscovered(storage), false);
});
