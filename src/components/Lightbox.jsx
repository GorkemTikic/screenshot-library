import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { resolveImageUrl } from '../utils/imageUtils';

export function Lightbox({ src, onClose }) {
    // Hooks must run on every render (before any early return), so the hook
    // order stays stable when `src` toggles between null (closed) and a value.
    useEffect(() => {
        if (!src) return;
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [src, onClose]);

    if (!src) return null;

    return (
        <div
            className="lightbox-overlay"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="lightbox-close"
            >
                <X size={32} />
            </button>

            <img
                src={resolveImageUrl(src)}
                alt="Preview"
                className="lightbox-image"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
}
