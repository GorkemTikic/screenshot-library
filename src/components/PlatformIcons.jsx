import React from 'react';
import { Smartphone, Monitor } from 'lucide-react';

// Robust CSS-based 3D Icons (Mac OS / iOS App Icon Style)
// Avoids SVG 'defs' and 'url(#id)' reference issues with HashRouter.

export const MobileIcon3D = ({ className }) => (
    <div className={`${className} relative flex items-center justify-center`} style={{ isolation: 'isolate' }}>
        {/* Main Icon Shape (Squircle with Gradient) */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/40"></div>

        {/* Inner Glow/Gloss (Top) */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent opacity-80 pointer-events-none"></div>

        {/* Icon Glyph (White, Drop Shadow) */}
        <div className="relative z-10 text-white drop-shadow-md">
            <Smartphone size={32} strokeWidth={2.5} />
        </div>

        {/* Bottom Refection */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/10 to-transparent rounded-b-2xl pointer-events-none"></div>
    </div>
);

export const WebIcon3D = ({ className }) => (
    <div className={`${className} relative flex items-center justify-center`} style={{ isolation: 'isolate' }}>
        {/* Main Icon Shape (Squircle with Gradient) */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-600 shadow-lg shadow-purple-500/40"></div>

        {/* Inner Glow/Gloss (Top) */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent opacity-80 pointer-events-none"></div>

        {/* Icon Glyph (White, Drop Shadow) */}
        <div className="relative z-10 text-white drop-shadow-md">
            <Monitor size={32} strokeWidth={2.5} />
        </div>

        {/* Bottom Refection */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/10 to-transparent rounded-b-2xl pointer-events-none"></div>
    </div>
);
