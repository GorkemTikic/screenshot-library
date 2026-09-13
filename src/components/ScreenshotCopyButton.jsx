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

export function ScreenshotCopyButton({ item, source, session, image, className = '' }) {
    const [state, setState] = useState({ status: 'idle', message: '' });
    const activeRun = useRef(null);
    const edited = Boolean(session && isMarkupDirty(session));

    useEffect(() => () => {
        invalidateCopyRun(activeRun.current);
        activeRun.current = null;
    }, [item.id]);

    const handleCopy = async () => {
        if (state.status === 'pending') return;
        const run = beginCopyRun(activeRun.current, item.id);
        activeRun.current = run;
        setState({ status: 'pending', message: 'Preparing screenshot…' });
        const outcome = await copyScreenshot(resolveImageUrl(item.image), {
            session,
            image,
            signal: run.controller.signal,
        });

        commitCopyOutcome(run, activeRun.current, item.id, {
            present: () => {
                if (outcome.ok) {
                    setState({ status: 'success', message: 'Paste it on chat' });
                    window.setTimeout(() => {
                        commitCopyOutcome(run, activeRun.current, item.id, {
                            present: () => setState({ status: 'idle', message: '' }),
                        });
                    }, 1800);
                } else {
                    setState({ status: 'error', message: ERROR_COPY[outcome.reason] || ERROR_COPY.write });
                }
            },
            report: () => logEvent('copy_image', imageCopyEvent(item, {
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
