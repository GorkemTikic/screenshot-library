export async function copyPlainText(text, environment = {}) {
    const clipboard = environment.clipboard ?? globalThis.navigator?.clipboard;
    const isSecureContext = environment.isSecureContext ?? globalThis.isSecureContext;
    const documentRef = environment.document ?? globalThis.document;

    if (clipboard && isSecureContext) {
        try {
            await clipboard.writeText(text);
            return true;
        } catch { /* continue with iframe-safe fallback */ }
    }

    if (!documentRef?.body || typeof documentRef.execCommand !== 'function') return false;
    const textArea = documentRef.createElement('textarea');
    textArea.value = text;
    Object.assign(textArea.style, {
        position: 'fixed', left: '0', top: '0', width: '1px', height: '1px',
        padding: '0', border: '0', opacity: '0', pointerEvents: 'none',
    });
    documentRef.body.appendChild(textArea);
    textArea.focus({ preventScroll: true });
    textArea.select();
    const successful = documentRef.execCommand('copy');
    textArea.remove();
    return successful;
}
