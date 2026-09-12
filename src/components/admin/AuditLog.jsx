import React, { useEffect, useState } from 'react';
import { contentApi } from '../../services/contentApi';
import { AppIcon } from '../AppIcon';

export function AuditLog() {
    const [events, setEvents] = useState([]);
    const [status, setStatus] = useState('Loading publishing history…');
    const load = async () => { try { const result = await contentApi.audit(); setEvents(result.events); setStatus(''); } catch (error) { setStatus(error.message); } };
    useEffect(() => {
        let alive = true;
        contentApi.audit().then((result) => { if (alive) { setEvents(result.events); setStatus(''); } }).catch((error) => { if (alive) setStatus(error.message); });
        return () => { alive = false; };
    }, []);
    return <section className="audit-panel"><div className="panel-heading"><div><span className="eyebrow">Immutable activity</span><h2>Publishing history</h2><p>Who changed what, when, and in which repository version.</p></div><button type="button" className="icon-button" onClick={load}><AppIcon name="RefreshCw" size={16} /></button></div>{status && <p className="inline-status">{status}</p>}<div className="audit-timeline">{events.map((event) => <article className="audit-event" key={event.id}><span className="audit-node"><AppIcon name={event.action === 'create' ? 'Plus' : event.action === 'archive' ? 'Archive' : 'Pencil'} size={14} /></span><div><div className="audit-title"><strong>{event.contributorName}</strong><span>{event.action.replace('-', ' ')}</span><b>#{event.recordId}</b></div><p>{event.changedFields?.join(', ') || 'No fields listed'}</p><small>{new Date(event.createdAt).toLocaleString()} · commit {String(event.commitSha || '').slice(0, 8)}</small></div></article>)}</div>{!status && !events.length && <div className="studio-empty"><AppIcon name="Activity" size={28} /><h3>No publishing events yet</h3><p>The first Content Studio update will appear here.</p></div>}</section>;
}
