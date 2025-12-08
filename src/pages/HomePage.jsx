import React from 'react';
import { ScreenshotGallery } from '../components/ScreenshotGallery';

export function HomePage() {
    return (
        <>
            <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
                <p className="text-gray-500 dark:text-gray-400">Quickly find the support screenshot you need.</p>
            </div>
            <ScreenshotGallery />
        </>
    );
}
