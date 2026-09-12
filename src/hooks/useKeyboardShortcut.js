import { useEffect } from 'react';
import { shouldHandleSearchShortcut } from '../domain/shortcuts';

export function useSearchShortcut(inputRef) {
    useEffect(() => {
        const onKeyDown = (event) => {
            if (!shouldHandleSearchShortcut({
                key: event.key,
                metaKey: event.metaKey,
                ctrlKey: event.ctrlKey,
                targetTag: event.target?.tagName,
                contentEditable: event.target?.isContentEditable,
            })) return;
            event.preventDefault();
            inputRef.current?.focus();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [inputRef]);
}
