const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function shouldHandleSearchShortcut({ key, metaKey, ctrlKey, targetTag, contentEditable = false }) {
    if (contentEditable || EDITABLE_TAGS.has(String(targetTag || '').toUpperCase())) return false;
    return key === '/' || (key.toLowerCase() === 'k' && (metaKey || ctrlKey));
}
