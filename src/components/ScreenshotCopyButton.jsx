import React, { useEffect, useRef, useState } from 'react';
import { isMarkupDirty, markupToolsUsed } from '../domain/markup';
import { imageCopyEvent } from '../domain/analyticsEvents';
import { beginCopyRun, commitCopyOutcome, invalidateCopyRun } from '../domain/copyRun';
import { logEvent } from '../services/analytics';
import { copyScreenshot } from '../utils/imageClipboard';
import { resolveImageUrl } from '../utils/imageUtils';
import { AppIcon } from './AppIcon';

const ERROR_COPY = {
    permission: 'Allow clipboard access and try again.',
    unsupported: 'This browser cannot copy images directly.',
    decode: 'The screenshot could not be prepared.',
    encode: 'The screenshot could not be prepared.',
    write: 'The screenshot could not be copied.',
};

const idleState = (itemKey) => ({ itemKey, status: 'idle', message: '' });

function clearCopyTimer(timerRef) {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
}

export function ScreenshotCopyButton({
    item,
    source,
    session,
    image,
    className = '',
    copyScreenshotFn = copyScreenshot,
    logEventFn = logEvent,
}) {
    const itemKey = String(item.id ?? '');
    const [storedState, setState] = useState(() => idleState(itemKey));
    let state = storedState;
    if (storedState.itemKey !== itemKey) {
        state = idleState(itemKey);
        setState(state);
    }
    const activeRun = useRef(null);
    const resetTimer = useRef(null);
    const edited = Boolean(session && isMarkupDirty(session));

    useEffect(() => {
        invalidateCopyRun(activeRun.current);
        activeRun.current = null;
        clearCopyTimer(resetTimer);
    }, [itemKey]);

    useEffect(() => () => {
        invalidateCopyRun(activeRun.current);
        activeRun.current = null;
        clearCopyTimer(resetTimer);
    }, []);

    const handleCopy = async () => {
        if (state.status === 'pending') return;
        clearCopyTimer(resetTimer);
        const run = beginCopyRun(activeRun.current, itemKey);
        activeRun.current = run;
        setState({ itemKey, status: 'pending', message: 'Preparing screenshot…' });
        const outcome = await copyScreenshotFn(resolveImageUrl(item.image), {
            session,
            image,
            signal: run.controller.signal,
        });

        commitCopyOutcome(run, activeRun.current, itemKey, {
            present: () => {
                if (outcome.ok) {
                    setState({ itemKey, status: 'success', message: 'Paste it on chat' });
                    resetTimer.current = window.setTimeout(() => {
                        resetTimer.current = null;
                        commitCopyOutcome(run, activeRun.current, itemKey, {
                            present: () => setState(idleState(itemKey)),
                        });
                    }, 1800);
                } else {
                    setState({ itemKey, status: 'error', message: ERROR_COPY[outcome.reason] || ERROR_COPY.write });
                }
            },
            report: () => logEventFn('copy_image', imageCopyEvent(item, {
                source,
                ...outcome,
                edited,
                toolsUsed: edited ? markupToolsUsed(session) : [],
            })),
        });
    };

    const label = state.status === 'pending'
        ? 'Preparing…'
        : state.status === 'success'
            ? 'Screenshot copied'
            : 'Copy Screenshot';
    const statusId = `${source}-copy-status-${item.id}`;

    return (
        <div className={`screenshot-copy ${className}`.trim()}>
            <button
                type="button"
                className={`btn btn-screenshot-copy ${state.status}`}
                onClick={handleCopy}
                disabled={state.status === 'pending'}
                aria-describedby={statusId}
            >
                <AppIcon name={state.status === 'success' ? 'Check' : state.status === 'pending' ? 'LoaderCircle' : 'Images'} size={15} />
                {label}
            </button>
            <span id={statusId} className={`copy-status ${state.status}`} role="status" aria-live="polite">{state.message}</span>
        </div>
    );
}
