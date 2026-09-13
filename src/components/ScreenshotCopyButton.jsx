import React, { useEffect, useRef, useState } from 'react';
import { isMarkupDirty, markupToolsUsed } from '../domain/markup';
import { imageCopyEvent } from '../domain/analyticsEvents';
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
    const runId = useRef(0);
    const edited = Boolean(session && isMarkupDirty(session));

    useEffect(() => () => {
        runId.current += 1;
    }, [item.id]);

    const handleCopy = async () => {
        if (state.status === 'pending') return;
        const currentRun = ++runId.current;
        setState({ status: 'pending', message: 'Preparing screenshot…' });
        const outcome = await copyScreenshot(resolveImageUrl(item.image), { session, image });
        if (currentRun !== runId.current) return;

        logEvent('copy_image', imageCopyEvent(item, {
            source,
            ...outcome,
            edited,
            toolsUsed: edited ? markupToolsUsed(session) : [],
        }));

        if (outcome.ok) {
            setState({ status: 'success', message: 'Paste it on chat' });
            window.setTimeout(() => {
                if (currentRun === runId.current) setState({ status: 'idle', message: '' });
            }, 1800);
        } else {
            setState({ status: 'error', message: ERROR_COPY[outcome.reason] || ERROR_COPY.write });
        }
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
