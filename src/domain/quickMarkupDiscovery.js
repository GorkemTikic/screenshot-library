const DISCOVERED_KEY = 'fd_quick_markup_discovered_v1';

function readStorage(storage) {
  return storage ?? globalThis.localStorage;
}

export const QUICK_MARKUP_DISCOVERED_KEY = DISCOVERED_KEY;

export function isQuickMarkupDiscovered(storage) {
  try {
    return readStorage(storage)?.getItem?.(DISCOVERED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markQuickMarkupDiscovered(storage) {
  try {
    readStorage(storage)?.setItem?.(DISCOVERED_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export function shouldShowQuickMarkupTip({ discovered = false, softDismissed = false } = {}) {
  return !discovered && !softDismissed;
}
