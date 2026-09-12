import React from 'react';
import { AppIcon } from './AppIcon';

export function Toast({ message, visible }) {
    return (
        <div className={`toast ${visible ? 'visible' : ''}`} role="status" aria-live="polite">
            <span className="toast-icon"><AppIcon name="Check" size={14} /></span>
            {message}
        </div>
    );
}
