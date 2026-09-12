import React, { useMemo } from 'react';
import { ScreenshotGallery } from '../components/ScreenshotGallery';
import { useData } from '../contexts/DataContext';
import { latestCatalogUpdate, visibleCatalog } from '../domain/catalog';
import { AppIcon } from '../components/AppIcon';

export function HomePage() {
    const { items } = useData();
    const publicItems = useMemo(() => visibleCatalog(items), [items]);
    const latest = useMemo(() => latestCatalogUpdate(items), [items]);
    const latestLabel = latest.getTime() > 0
        ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(latest)
        : 'Not available';

    return (
        <>
            <section className="library-hero animate-in">
                <div>
                    <span className="eyebrow"><AppIcon name="Sparkles" size={14} /> FD knowledge workspace</span>
                    <h1>Find the right screenshot, instantly.</h1>
                    <p>
                        Search the operational screenshot library, switch between EN and TR responses,
                        and copy a ready-to-send explanation without leaving your support flow.
                    </p>
                </div>
                <div className="hero-metrics" aria-label="Library summary">
                    <div className="hero-metric">
                        <strong>{publicItems.length}</strong>
                        <span>Verified guides</span>
                    </div>
                    <div className="hero-metric">
                        <strong>{latestLabel}</strong>
                        <span>Latest update</span>
                    </div>
                </div>
            </section>
            <ScreenshotGallery />
        </>
    );
}
