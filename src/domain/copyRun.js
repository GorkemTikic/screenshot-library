export function invalidateCopyRun(run) {
    run?.controller.abort();
}

export function beginCopyRun(previousRun, itemId, AbortControllerClass = globalThis.AbortController) {
    invalidateCopyRun(previousRun);
    return {
        itemId: String(itemId ?? ''),
        controller: new AbortControllerClass(),
    };
}

export function commitCopyOutcome(run, activeRun, currentItemId, callbacks = {}) {
    const current = run === activeRun
        && run?.itemId === String(currentItemId ?? '')
        && !run.controller.signal.aborted;
    if (!current) return false;

    callbacks.present?.();
    try {
        callbacks.report?.();
    } catch {
        // Analytics must never suppress the user-visible clipboard outcome.
    }
    return true;
}
