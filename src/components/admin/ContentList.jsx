import React, { useMemo, useState } from 'react';
import { AppIcon } from '../AppIcon';
import { normalizePlatform, ownerInitials, visibleCatalog } from '../../domain/catalog';

const imageUrl = (value) => /^(https?:|data:)/.test(value || '') ? value : `${import.meta.env.BASE_URL}${value || ''}`;

export function ContentList({ items, onEdit, onCreate, onRefresh, loading }) {
    const [query, setQuery] = useState('');
    const [platform, setPlatform] = useState('all');
    const filtered = useMemo(() => visibleCatalog(items).filter((item) => {
        const matchesQuery = !query || [item.title, item.text, item.text_tr, item.owner, item.topic].some((value) => String(value || '').toLowerCase().includes(query.toLowerCase()));
        return matchesQuery && (platform === 'all' || normalizePlatform(item.platform) === platform);
    }), [items, platform, query]);

    return <section className="studio-content">
        <div className="studio-toolbar">
            <label className="studio-search"><AppIcon name="Search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, response, topic or owner…" /></label>
            <div className="platform-switch studio-platforms" aria-label="Filter by platform">
                {['all', 'mobile', 'web'].map((value) => <button type="button" key={value} className={platform === value ? 'platform-button active' : 'platform-button'} onClick={() => setPlatform(value)}>{value === 'mobile' && <AppIcon name="Smartphone" size={14} />}{value === 'web' && <AppIcon name="Monitor" size={14} />}{value === 'all' ? 'All' : value}</button>)}
            </div>
            <button type="button" className="icon-button" onClick={onRefresh} aria-label="Refresh published content" title="Refresh"><AppIcon name="RefreshCw" size={17} /></button>
            <button type="button" className="button button-primary" onClick={onCreate}><AppIcon name="Plus" size={16} /> New screenshot</button>
        </div>
        <div className="studio-list-summary"><span><strong>{filtered.length}</strong> published guides</span><span>{loading ? 'Fetching latest version…' : 'Live repository version'}</span></div>
        <div className="studio-card-grid">
            {filtered.map((item) => <article className="studio-record-card" key={item.id}>
                <button type="button" className="studio-record-image" onClick={() => onEdit(item)}><img src={imageUrl(item.image)} alt="" loading="lazy" /><span className="studio-edit-reveal"><AppIcon name="Pencil" size={15} /> Edit & replace</span></button>
                <div className="studio-record-body">
                    <div className="studio-record-kicker"><span>{item.topic}</span><span>{normalizePlatform(item.platform)}</span></div>
                    <h3>{item.title}</h3>
                    <div className="studio-record-footer"><span className="owner-mini"><i style={{ '--owner-hue': `${(String(item.owner || '').length * 47) % 360}deg` }}>{ownerInitials(item.owner)}</i>{item.owner}</span><button type="button" className="button button-quiet button-small" onClick={() => onEdit(item)}>Edit</button></div>
                </div>
            </article>)}
        </div>
        {!filtered.length && <div className="studio-empty"><AppIcon name="SearchX" size={28} /><h3>No matching screenshots</h3><p>Adjust the filters or create a new guide.</p></div>}
    </section>;
}
