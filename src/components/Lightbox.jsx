import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { resolveImageUrl } from '../utils/imageUtils';

export function Lightbox({ src, onClose }) {
    if (!src) return null;

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

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
