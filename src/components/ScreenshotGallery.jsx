import React, { useState, useMemo } from 'react';
import { Search, Filter, X } from 'lucide-react';
import Fuse from 'fuse.js';
import { useData } from '../contexts/DataContext';
import { ScreenshotCard } from './ScreenshotCard';
import { Lightbox } from './Lightbox';

export function ScreenshotGallery() {
    const { items, allTopics, allLanguages, favorites, isFavorite } = useData();

    const [search, setSearch] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('All');
    const [selectedLang, setSelectedLang] = useState('All');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    const [lightboxSrc, setLightboxSrc] = useState(null);

    const fuse = useMemo(() => {
        return new Fuse(items, {
            keys: ['title', 'text', 'topic'],
            threshold: 0.3,
        });
    }, [items]);

    const filteredItems = useMemo(() => {
        let result = items;
        if (search.trim()) {
            const fuseResult = fuse.search(search);
            result = fuseResult.map(r => r.item);
        }
        if (selectedTopic !== 'All') {
            result = result.filter(i => i.topic === selectedTopic);
        }
        if (selectedLang !== 'All') {
            result = result.filter(i => i.language === selectedLang);
        }
        if (showFavoritesOnly) {
            result = result.filter(i => isFavorite(i.title));
        }
        return result;
    }, [items, search, selectedTopic, selectedLang, fuse, showFavoritesOnly, favorites, isFavorite]);

    return (
        <div className="gallery-container">
            {/* Controls */}
            <div className="gallery-controls">
                <div className="controls-inner">
                    {/* Search */}
                    <div className="search-wrapper">
                        <Search className="search-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="search-input"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="clear-search"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="filters-row">
                        <select
                            className="filter-select"
                            value={selectedLang}
                            onChange={e => setSelectedLang(e.target.value)}
                        >
                            <option value="All">All Languages</option>
                            {allLanguages.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>

                        <select
                            className="filter-select"
                            value={selectedTopic}
                            onChange={e => setSelectedTopic(e.target.value)}
                        >
                            <option value="All">All Topics</option>
                            {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>

                        <button
                            className={`filter-btn ${showFavoritesOnly ? 'active' : ''}`}
                            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                        >
                            {showFavoritesOnly ? '★ Favorites Only' : '☆ Favorites'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Info */}
            <div className="results-info">
                Showing {filteredItems.length} result{filteredItems.length !== 1 && 's'}
            </div>

            {/* Grid */}
            {filteredItems.length > 0 ? (
                <div className="gallery-grid">
                    {filteredItems.map((item, idx) => (
                        <ScreenshotCard
                            key={`${item.title}-${idx}`}
                            item={item}
                            onClickImage={(i) => setLightboxSrc(i.image)}
                        />
                    ))}
                </div>
            ) : (
                <div className="no-results">
                    <Filter size={48} className="no-results-icon" />
                    <p className="no-results-text">No match found.</p>
                    <button className="clear-filters-link" onClick={() => { setSearch(''); setSelectedLang('All'); setSelectedTopic('All'); }}>Clear Filters</button>
                </div>
            )}

            <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
        </div>
    );
}
