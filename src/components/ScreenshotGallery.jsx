import React, { useState, useMemo } from 'react';
import { Search, Filter, X } from 'lucide-react';
import Fuse from 'fuse.js';
import { useData } from '../contexts/DataContext';
import { ScreenshotCard } from './ScreenshotCard';
import { Lightbox } from './Lightbox';
import { MobileIcon3D, WebIcon3D } from './PlatformIcons';

export function ScreenshotGallery() {
    const { items, allTopics, allLanguages, favorites, isFavorite } = useData();

    const [search, setSearch] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('All');
    const [selectedLang, setSelectedLang] = useState('All');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState('mobile'); // 'mobile' | 'web'

    const [lightboxSrc, setLightboxSrc] = useState(null);

    const fuse = useMemo(() => {
        return new Fuse(items, {
            keys: ['title', 'text', 'topic'],
            threshold: 0.3,
        });
    }, [items]);

    const filteredItems = useMemo(() => {
        let result = items;

        // 1. Platform Filter (Default to mobile if undefined)
        result = result.filter(i => {
            const itemPlatform = i.platform || 'mobile';
            return itemPlatform === selectedPlatform;
        });

        // 2. Search
        if (search.trim()) {
            const fuseResult = fuse.search(search);
            // Fuse returns matching items from the full list. We need to intersect this with our platform-filtered result.
            // A simpler way is to check if the platform-filtered items are in the fuse result.
            const searchIds = new Set(fuseResult.map(r => r.item.id));
            result = result.filter(i => searchIds.has(i.id));
        }

        // 3. Filters
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
    }, [items, search, selectedTopic, selectedLang, fuse, showFavoritesOnly, favorites, isFavorite, selectedPlatform]);

    return (
        <div className="gallery-container">
            {/* Controls */}
            <div className="gallery-controls">
                <div className="controls-inner">

                    {/* Platform Toggle */}
                    <div className="flex gap-4 mr-8">
                        <button
                            onClick={() => setSelectedPlatform('mobile')}
                            className={`group relative flex flex-col items-center justify-center transition-all duration-200 ${selectedPlatform === 'mobile' ? 'transform scale-110' : 'opacity-70 hover:opacity-100'
                                }`}
                        >
                            <div className="w-16 h-16 drop-shadow-xl filter transition-all duration-300">
                                <MobileIcon3D className="w-full h-full" />
                            </div>

                            {/* Active Indicator */}
                            {selectedPlatform === 'mobile' && (
                                <span className="absolute -bottom-2 w-12 h-1 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
                            )}
                        </button>

                        <button
                            onClick={() => setSelectedPlatform('web')}
                            className={`group relative flex flex-col items-center justify-center transition-all duration-200 ${selectedPlatform === 'web' ? 'transform scale-110' : 'opacity-70 hover:opacity-100'
                                }`}
                        >
                            <div className="w-16 h-16 drop-shadow-xl filter transition-all duration-300">
                                <WebIcon3D className="w-full h-full" />
                            </div>

                            {/* Active Indicator */}
                            {selectedPlatform === 'web' && (
                                <span className="absolute -bottom-2 w-12 h-1 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></span>
                            )}
                        </button>
                    </div>

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
                    <button className="clear-filters-link" onClick={() => { setSearch(''); setSelectedLang('All'); setSelectedTopic('All'); setSelectedPlatform('mobile'); }}>Clear Filters</button>
                </div>
            )}

            <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
        </div>
    );
}
