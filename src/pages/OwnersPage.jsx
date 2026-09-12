import React, { useEffect, useMemo, useState } from 'react';
import { AccessGate } from '../components/AccessGate';
import { AppIcon } from '../components/AppIcon';
import { aggregateOwners, ownerHue, ownerInitials } from '../domain/catalog';
import { useData } from '../contexts/DataContext';
import { fetchOwnerStats } from '../services/analytics';

const imageUrl = (value) => /^(https?:|data:)/.test(value || '') ? value : `${import.meta.env.BASE_URL}${value || ''}`;

function OwnersWorkspace() {
    const { items } = useData();
    const [remote, setRemote] = useState([]);
    const [remoteError, setRemoteError] = useState('');
    const [selected, setSelected] = useState(null);
    useEffect(() => { let alive = true; fetchOwnerStats().then((rows) => alive && setRemote(rows)).catch((error) => alive && setRemoteError(error.message)); return () => { alive = false; }; }, []);
    const owners = useMemo(() => aggregateOwners(items, remote), [items, remote]);
    const totalGuides = owners.reduce((sum, owner) => sum + owner.guides, 0);
    const active = owners.find((owner) => owner.owner === selected) || owners[0];
    const contributions = active ? items.filter((item) => item.owner === active.owner && !item.archivedAt).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))) : [];

    return <div className="owners-page animate-in">
        <header className="owners-header"><div><span className="eyebrow"><AppIcon name="UsersRound" size={13} /> Editorial ownership</span><h1>The people behind the library</h1><p>Coverage, language responsibility and live usage—credited to every screenshot owner.</p></div><div className="owner-total"><strong>{owners.length}</strong><span>owners</span><i /> <strong>{totalGuides}</strong><span>guides</span></div></header>
        {remoteError && <div className="owner-data-note"><AppIcon name="Activity" size={15} /><span>Live interaction totals are unavailable; catalog ownership remains accurate. {remoteError}</span></div>}
        <div className="owners-workspace"><section className="owner-roster">{owners.map((owner, index) => <button type="button" key={owner.owner} onClick={() => setSelected(owner.owner)} className={active?.owner === owner.owner ? 'owner-roster-card active' : 'owner-roster-card'}><span className="owner-rank">{String(index + 1).padStart(2, '0')}</span><span className="owner-avatar-large" style={{ '--owner-hue': `${ownerHue(owner.owner)}deg` }}>{ownerInitials(owner.owner)}</span><span className="owner-roster-copy"><strong>{owner.owner}</strong><small>{owner.languages.join(' · ')}</small></span><span className="owner-guide-count"><strong>{owner.guides}</strong><small>guides</small></span></button>)}</section>
            {active && <aside className="owner-profile"><div className="owner-profile-hero"><span className="owner-avatar-xl" style={{ '--owner-hue': `${ownerHue(active.owner)}deg` }}>{ownerInitials(active.owner)}</span><div><span className="eyebrow">Screenshot owner</span><h2>{active.owner}</h2><p>Latest catalog contribution {active.latest ? new Date(active.latest).toLocaleDateString() : '—'}</p></div></div><div className="owner-profile-metrics"><div><strong>{active.guides}</strong><span>Published</span></div><div><strong>{active.views || '—'}</strong><span>Views</span></div><div><strong>{active.copies || '—'}</strong><span>Copies</span></div><div><strong>{active.interactions || '—'}</strong><span>Total activity</span></div></div><div className="owner-taxonomy"><div><small>Topics</small><p>{active.topics.map((topic) => <span key={topic}>{topic}</span>)}</p></div><div><small>Languages</small><p>{active.languages.map((language) => <span key={language}>{language}</span>)}</p></div></div><div className="owner-contributions-heading"><div><strong>Latest contributions</strong><span>{contributions.length} records</span></div></div><div className="owner-contributions">{contributions.slice(0, 8).map((item) => <article key={item.id}><img src={imageUrl(item.image)} alt="" /><div><strong>{item.title}</strong><span>{item.topic} · {item.language}</span></div></article>)}</div></aside>}
        </div>
    </div>;
}

export function OwnersPage() {
    return <AccessGate ownerOnly title="Owner workspace"><OwnersWorkspace /></AccessGate>;
}
