import React, { useMemo } from 'react';
import { ScreenshotGallery } from '../components/ScreenshotGallery';
import { useData } from '../contexts/DataContext';
import { latestCatalogUpdate, visibleCatalog } from '../domain/catalog';
import { AppIcon } from '../components/AppIcon';

export function HomePage() {
    const { items } = useData();
    const publicItems = useMemo(() => visibleCatalog(items), [items]);
    const latest = useMemo(() => latestCatalogUpdate(items), [items]);
    const languageCount = useMemo(
        () => new Set(publicItems.map((item) => item.language).filter(Boolean)).size,
        [publicItems],
    );
    const latestLabel = latest.getTime() > 0
        ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(latest)
        : 'Not available';

    return (
        <>
            <section className="library-hero animate-in">
                <div className="hero-copy">
                    <h1 className="hero-flow">
                        <span className="hero-beat beat-find">Find the Shot</span>
                        <span className="hero-arrow" aria-hidden="true">→</span>
                        <span className="hero-beat beat-copy">Copy It</span>
                        <span className="hero-arrow" aria-hidden="true">→</span>
                        <span className="hero-beat beat-send">Paste It in Chat.</span>
                    </h1>
                    <p>The right visual, the ready response, and one-click copy—without breaking your support flow.</p>
                </div>
                <div className="library-pulse" aria-label="Library summary">
                    <div className="pulse-item">
                        <AppIcon name="FileImage" size={14} />
                        <strong>{publicItems.length}</strong>
                        <span>guides</span>
                    </div>
                    <i className="pulse-divider" aria-hidden="true" />
                    <div className="pulse-item">
                        <AppIcon name="Languages" size={14} />
                        <strong>{languageCount}</strong>
                        <span>languages</span>
                    </div>
                    <i className="pulse-divider" aria-hidden="true" />
                    <div className="pulse-item pulse-update">
                        <AppIcon name="Clock3" size={14} />
                        <span>updated</span>
                        <strong>{latestLabel}</strong>
                    </div>
                </div>
            </section>
            <ScreenshotGallery />
        </>
    );
}
