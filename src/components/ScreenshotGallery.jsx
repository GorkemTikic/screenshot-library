import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { useData } from '../contexts/DataContext';
import { useRequestModal } from '../contexts/RequestModalContext';
import { filterCatalog, normalizePlatform, TOPIC_META, topicCounts } from '../domain/catalog';
import { discoveryEvent, screenshotEvent } from '../domain/analyticsEvents';
import { useSearchShortcut } from '../hooks/useKeyboardShortcut';
import { logEvent } from '../services/analytics';
import { AppIcon } from './AppIcon';
import { ScreenshotCard } from './ScreenshotCard';
import { Lightbox } from './Lightbox';

export function ScreenshotGallery() {
    const { items, allLanguages, favorites } = useData();
    const { open: openRequestModal } = useRequestModal();
    const searchRef = useRef(null);
    const [search, setSearch] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('All');
    const [selectedLang, setSelectedLang] = useState('All');
    const [selectedPlatform, setSelectedPlatform] = useState('mobile');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [inspectorIndex, setInspectorIndex] = useState(null);
    useSearchShortcut(searchRef);

    const fuse = useMemo(() => new Fuse(items, {
        keys: ['title', 'text', 'text_tr', 'topic', 'language', 'owner', 'platform'],
        threshold: 0.3,
        ignoreLocation: true,
    }), [items]);

    const matchedIds = useMemo(() => search.trim()
        ? new Set(fuse.search(search.trim()).map((result) => result.item.id))
        : null, [fuse, search]);

    const filteredItems = useMemo(() => filterCatalog(items, {
        matchedIds,
        platform: selectedPlatform,
        topic: selectedTopic,
        language: selectedLang,
        favoritesOnly: showFavoritesOnly,
        favoriteTitles: favorites,
    }), [items, matchedIds, selectedPlatform, selectedTopic, selectedLang, showFavoritesOnly, favorites]);

    const resultCountFor = useCallback((overrides = {}) => filterCatalog(items, {
        matchedIds,
        platform: selectedPlatform,
        topic: selectedTopic,
        language: selectedLang,
        favoritesOnly: showFavoritesOnly,
        favoriteTitles: favorites,
        ...overrides,
    }).length, [favorites, items, matchedIds, selectedLang, selectedPlatform, selectedTopic, showFavoritesOnly]);

    useEffect(() => {
        const query = search.trim();
        if (query.length < 2) return undefined;
        const timer = window.setTimeout(() => {
            logEvent('search_commit', {
                ...discoveryEvent(query, filteredItems.length),
                filterPlatform: selectedPlatform,
                filterTopic: selectedTopic,
                filterLanguage: selectedLang,
            });
        }, 600);
        return () => window.clearTimeout(timer);
    }, [filteredItems.length, search, selectedLang, selectedPlatform, selectedTopic]);

    const counts = useMemo(() => topicCounts(items, selectedPlatform), [items, selectedPlatform]);
    const platformTotal = useMemo(() => items.filter((item) => !item.archivedAt && normalizePlatform(item.platform) === selectedPlatform).length, [items, selectedPlatform]);
    const clearFilters = () => {
        setSearch('');
        setSelectedLang('All');
        setSelectedTopic('All');
        setSelectedPlatform('mobile');
        setShowFavoritesOnly(false);
        logEvent('filters_reset', discoveryEvent('all', resultCountFor({ platform: 'mobile', topic: 'All', language: 'All', favoritesOnly: false })));
    };

    const activeFilters = [
        selectedTopic !== 'All' && { label: selectedTopic, clear: () => setSelectedTopic('All') },
        selectedLang !== 'All' && { label: selectedLang, clear: () => setSelectedLang('All') },
        showFavoritesOnly && { label: 'Favorites', clear: () => setShowFavoritesOnly(false) },
    ].filter(Boolean);

    return (
        <section className="gallery-container" aria-label="Screenshot library">
            <div className="gallery-controls">
                <div className="controls-inner">
                    <div className="platform-switch" role="group" aria-label="Platform">
                        {[
                            { value: 'mobile', label: 'Mobile', icon: 'Smartphone' },
                            { value: 'web', label: 'Web', icon: 'Monitor' },
                        ].map((platform) => (
                            <button
                                type="button"
                                key={platform.value}
                                className={`platform-button ${selectedPlatform === platform.value ? 'active' : ''}`}
                                aria-pressed={selectedPlatform === platform.value}
                                onClick={() => {
                                    logEvent('filter_platform', discoveryEvent(platform.value, resultCountFor({ platform: platform.value })));
                                    setSelectedPlatform(platform.value);
                                }}
                            >
                                <AppIcon name={platform.icon} size={16} /> {platform.label}
                            </button>
                        ))}
                    </div>

                    <div className="search-wrapper command-search">
                        <AppIcon name="Search" size={19} className="search-icon" />
                        <input
                            ref={searchRef}
                            type="search"
                            placeholder="Search title, response, topic or owner…"
                            className="search-input"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                    setSearch('');
                                    event.currentTarget.blur();
                                }
                            }}
                        />
                        {!search && <kbd className="search-shortcut">⌘ K</kbd>}
                        {search && (
                            <button type="button" onClick={() => setSearch('')} className="clear-search" aria-label="Clear search">
                                <AppIcon name="X" size={15} />
                            </button>
                        )}
                    </div>

                    <div className="filters-row">
                        <select className="filter-select" value={selectedLang} onChange={(event) => {
                            const value = event.target.value;
                            logEvent('filter_language', discoveryEvent(value, resultCountFor({ language: value })));
                            setSelectedLang(value);
                        }} aria-label="Language">
                            <option value="All">All languages</option>
                            {allLanguages.map((language) => <option key={language} value={language}>{language}</option>)}
                        </select>
                        <button
                            type="button"
                            className={`filter-btn ${showFavoritesOnly ? 'active' : ''}`}
                            aria-pressed={showFavoritesOnly}
                            onClick={() => {
                                const next = !showFavoritesOnly;
                                logEvent('filter_favorites', discoveryEvent(next ? 'on' : 'off', resultCountFor({ favoritesOnly: next })));
                                setShowFavoritesOnly(next);
                            }}
                        >
                            <AppIcon name="Heart" size={15} /> Favorites
                        </button>
                    </div>
                </div>
            </div>

            <div className="category-rail" aria-label="Topics">
                <button type="button" className={`category-button ${selectedTopic === 'All' ? 'active' : ''}`} onClick={() => { logEvent('filter_topic', discoveryEvent('All', resultCountFor({ topic: 'All' }))); setSelectedTopic('All'); }}>
                    <span className="category-icon"><AppIcon name="LayoutGrid" size={17} /></span>
                    <span className="category-copy"><strong>All topics</strong><small>{platformTotal} guides</small></span>
                </button>
                {Object.entries(TOPIC_META).map(([topic, meta]) => (
                    <button type="button" key={topic} className={`category-button tone-${meta.tone} ${selectedTopic === topic ? 'active' : ''}`} onClick={() => { logEvent('filter_topic', discoveryEvent(topic, resultCountFor({ topic }))); setSelectedTopic(topic); }}>
                        <span className="category-icon"><AppIcon name={meta.icon} size={17} /></span>
                        <span className="category-copy"><strong>{topic}</strong><small>{counts[topic] || 0} guides</small></span>
                    </button>
                ))}
            </div>

            <div className="results-info" aria-live="polite">
                <span><strong>{filteredItems.length}</strong> of {platformTotal} screenshots</span>
                <div className="active-filter-list">
                    {activeFilters.map((filter) => (
                        <button type="button" className="active-filter-chip" key={filter.label} onClick={filter.clear}>
                            {filter.label} <AppIcon name="X" size={12} />
                        </button>
                    ))}
                </div>
            </div>

            {filteredItems.length ? (
                <div className="gallery-grid">
                    {filteredItems.map((item, index) => (
                        <ScreenshotCard key={item.id} item={item} search={search} onInspect={() => setInspectorIndex(index)} />
                    ))}
                </div>
            ) : (
                <div className="no-results">
                    <AppIcon name="SearchX" size={42} className="no-results-icon" />
                    <p className="no-results-text">No matching screenshot</p>
                    <p className="text-muted">Try a broader term, switch platform, or ask the team for a new guide.</p>
                    <div className="empty-actions">
                        <button type="button" className="button button-quiet" onClick={clearFilters}><AppIcon name="RotateCcw" size={15} /> Reset filters</button>
                        <button type="button" className="button button-primary" onClick={() => openRequestModal({ prefillSearch: search })}><AppIcon name="MessageSquarePlus" size={15} /> Request screenshot</button>
                    </div>
                </div>
            )}

            {inspectorIndex !== null && filteredItems[inspectorIndex] && (
                <Lightbox
                    key={filteredItems[inspectorIndex].id}
                    item={filteredItems[inspectorIndex]}
                    position={inspectorIndex}
                    total={filteredItems.length}
                    onClose={() => setInspectorIndex(null)}
                    onNavigate={(direction) => setInspectorIndex((index) => {
                        const next = (index + direction + filteredItems.length) % filteredItems.length;
                        logEvent('inspector_navigate', screenshotEvent(filteredItems[next], { source: 'inspector', direction: direction < 0 ? 'previous' : 'next' }));
                        return next;
                    })}
                />
            )}
        </section>
    );
}
