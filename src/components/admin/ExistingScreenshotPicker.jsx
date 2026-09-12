import React, { useEffect, useMemo, useRef, useState } from 'react';
import { normalizePlatform, ownerColorStyle, ownerInitials } from '../../domain/catalog';
import { filterStudioItems } from '../../domain/contentStudio';
import { AppIcon } from '../AppIcon';

const imageUrl = (value) => /^(https?:|data:)/.test(value || '') ? value : `${import.meta.env.BASE_URL}${value || ''}`;

export function ExistingScreenshotPicker({ items, onSelect, onClose }) {
    const [query, setQuery] = useState('');
    const [platform, setPlatform] = useState('all');
    const searchRef = useRef(null);
    const results = useMemo(() => filterStudioItems(items, { query, platform }), [items, platform, query]);

    useEffect(() => {
        searchRef.current?.focus();
        const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    return <div className="modal-overlay replace-picker-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <section className="replace-picker" role="dialog" aria-modal="true" aria-labelledby="replace-picker-title">
            <header className="replace-picker-header">
                <div><span className="eyebrow"><AppIcon name="RefreshCw" size={13} /> Replace existing</span><h2 id="replace-picker-title">Choose a screenshot to replace</h2><p>Select the published record first so its history, analytics, and ownership stay connected.</p></div>
                <button type="button" className="icon-button" onClick={onClose} aria-label="Close screenshot picker"><AppIcon name="X" /></button>
            </header>
            <div className="replace-picker-controls">
                <label className="studio-search"><AppIcon name="Search" size={16} /><input ref={searchRef} aria-label="Search existing screenshots" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, owner, topic, language or platform…" /></label>
                <div className="platform-switch studio-platforms" aria-label="Filter replacement candidates by platform">
                    {['all', 'mobile', 'web'].map((value) => <button type="button" key={value} className={platform === value ? 'platform-button active' : 'platform-button'} onClick={() => setPlatform(value)}>{value === 'all' ? 'All' : value}</button>)}
                </div>
            </div>
            <div className="replace-picker-summary"><strong>{results.length}</strong> published screenshots</div>
            <div className="replace-picker-results">
                {results.map((item) => <button type="button" className="replace-picker-item" key={item.id} onClick={() => onSelect(item)} aria-label={`Select ${item.title} to replace`}>
                    <img src={imageUrl(item.image)} alt="" />
                    <span className="replace-picker-item-copy"><small>{item.topic} · {item.language} · {normalizePlatform(item.platform)}</small><strong>{item.title}</strong><span><i style={ownerColorStyle(item.owner)}>{ownerInitials(item.owner)}</i>{item.owner}</span></span>
                    <AppIcon name="ChevronRight" size={17} />
                </button>)}
            </div>
            {!results.length && <div className="studio-empty"><AppIcon name="SearchX" size={28} /><h3>No published screenshots match</h3><p>Try a title, owner, topic, language, or another platform.</p></div>}
        </section>
    </div>;
}
