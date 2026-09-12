import React, { useCallback, useEffect, useMemo, useState } from 'react';
import bundledRequests from '../../data/requests.json';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import {
    REQUEST_STATUSES,
    REQUEST_STATUS_META,
    countRequestsByStatus,
    filterRequests,
    normalizeRequest,
    validateRequestResolution,
} from '../../domain/requests';
import { contentApi, ContentApiError } from '../../services/contentApi';
import { AppIcon } from '../AppIcon';

const ALL = 'all';
const dateLabel = (value) => value ? new Date(value).toLocaleString() : 'Time unavailable';

function StatusChip({ status }) {
    const meta = REQUEST_STATUS_META[status] || REQUEST_STATUS_META.new;
    return <span className={`request-status request-status-${status}`}><AppIcon name={meta.icon} size={12} />{meta.label}</span>;
}

function RequestCard({ request, active, onOpen }) {
    return <button type="button" className={`workflow-request-card ${active ? 'active' : ''}`} onClick={onOpen}>
        <span className="workflow-card-top"><StatusChip status={request.status} /><time>{dateLabel(request.updatedAt)}</time></span>
        <strong>{request.description}</strong>
        <span className="workflow-card-meta"><b>{request.topic || 'General'}</b><i />{request.requestedLanguage || 'Any language'}<i />{request.requestedPlatform || 'Either'}</span>
        <span className="workflow-card-owner"><AppIcon name="UserRound" size={12} />{request.assigneeName || 'Unassigned'}<small>{request.updatedByName ? `Last edit · ${request.updatedByName}` : request.id}</small></span>
    </button>;
}

export function RequestWorkflow() {
    const auth = useAuth();
    const { items } = useData();
    const [requests, setRequests] = useState(() => bundledRequests.map(normalizeRequest));
    const [assignees, setAssignees] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [filters, setFilters] = useState({ query: '', status: ALL, topic: ALL, language: ALL, assignee: ALL });
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState({ tone: '', text: '' });
    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setNotice({ tone: '', text: '' });
        try {
            const [requestResult, assigneeResult] = await Promise.all([contentApi.requests(), contentApi.requestAssignees()]);
            const next = (requestResult.requests || []).map(normalizeRequest);
            setRequests(next);
            setAssignees(assigneeResult.contributors || []);
            setSelectedId((current) => next.some((row) => row.id === current) ? current : next[0]?.id || '');
        } catch (error) {
            setNotice({ tone: 'error', text: `Live requests could not be loaded. Showing the repository snapshot. ${error.message}` });
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);
    const selected = requests.find((request) => request.id === selectedId) || null;
    useEffect(() => {
        if (!selected) { setDraft(null); return; }
        setDraft({
            status: selected.status,
            assigneeContributorId: selected.assigneeContributorId,
            resolutionNote: selected.resolutionNote,
            linkedRecordId: selected.linkedRecordId,
            baseVersion: selected.version,
        });
    }, [selected]);

    const counts = useMemo(() => countRequestsByStatus(requests), [requests]);
    const topics = useMemo(() => [...new Set(requests.map((row) => row.topic).filter(Boolean))].sort(), [requests]);
    const languages = useMemo(() => [...new Set(requests.map((row) => row.requestedLanguage).filter(Boolean))].sort(), [requests]);
    const filtered = useMemo(() => filterRequests(requests, filters), [filters, requests]);

    const save = async () => {
        const validation = validateRequestResolution(draft || {});
        if (validation) { setNotice({ tone: 'error', text: validation }); return; }
        setSaving(true); setNotice({ tone: '', text: '' });
        try {
            const result = await contentApi.updateRequest(selected.id, draft);
            const next = normalizeRequest(result.request);
            setRequests((current) => current.map((row) => row.id === next.id ? next : row));
            setNotice({ tone: next.syncState === 'pending' ? 'warning' : 'success', text: next.syncState === 'pending' ? 'Update accepted. Repository snapshot is pending and can be retried by an owner.' : 'Request updated for everyone.' });
        } catch (error) {
            if (error instanceof ContentApiError && error.code === 'REQUEST_CONFLICT' && error.latest) {
                const latest = normalizeRequest(error.latest);
                setRequests((current) => current.map((row) => row.id === latest.id ? latest : row));
                setDraft((current) => ({ ...current, baseVersion: latest.version }));
                setNotice({ tone: 'warning', text: `A newer edit by ${latest.updatedByName || 'another contributor'} was loaded. Your choices are preserved; review and save again.` });
            } else setNotice({ tone: 'error', text: error.message });
        } finally { setSaving(false); }
    };

    const importSheet = async () => {
        setSaving(true);
        try {
            const result = await contentApi.importRequests();
            setNotice({ tone: result.sync?.synced ? 'success' : 'warning', text: `Sheet import: ${result.inserted} added, ${result.existing} already present, ${result.invalid} invalid.` });
            await load();
        } catch (error) { setNotice({ tone: 'error', text: error.message }); }
        finally { setSaving(false); }
    };

    const resync = async () => {
        setSaving(true);
        try {
            const result = await contentApi.resyncRequests();
            setNotice({ tone: result.ok ? 'success' : 'error', text: result.ok ? 'Repository request snapshot synchronized.' : result.sync?.error || 'Snapshot sync failed.' });
            await load();
        } catch (error) { setNotice({ tone: 'error', text: error.message }); }
        finally { setSaving(false); }
    };

    const setFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
    const setDraftField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

    return <section className="request-operations">
        <header className="request-operations-head">
            <div><span className="eyebrow">Shared content queue</span><h2>Screenshot requests</h2><p>D1 is live; every accepted update is mirrored to the repository snapshot.</p></div>
            <div className="request-owner-actions"><button type="button" className="button button-quiet" onClick={load} disabled={loading || saving}><AppIcon name="RefreshCw" size={15} />Refresh</button>{auth.isOwner && <><button type="button" className="button button-quiet" onClick={importSheet} disabled={saving}><AppIcon name="ClipboardList" size={15} />Import Sheet</button><button type="button" className="button button-quiet" onClick={resync} disabled={saving}><AppIcon name="UploadCloud" size={15} />Sync snapshot</button></>}</div>
        </header>

        <div className="request-status-counters">
            {[['all', 'All'], ...REQUEST_STATUSES.map((status) => [status, REQUEST_STATUS_META[status].label])].map(([status, label]) => <button type="button" key={status} className={filters.status === status ? 'active' : ''} onClick={() => setFilter('status', status)}><strong>{counts[status]}</strong><span>{label}</span></button>)}
        </div>

        <div className="request-filterbar">
            <label className="studio-search"><AppIcon name="Search" size={15} /><input value={filters.query} onChange={(event) => setFilter('query', event.target.value)} placeholder="Search request, topic or ID…" /></label>
            <select className="form-select" aria-label="Request topic" value={filters.topic} onChange={(event) => setFilter('topic', event.target.value)}><option value={ALL}>All topics</option>{topics.map((value) => <option key={value}>{value}</option>)}</select>
            <select className="form-select" aria-label="Request language" value={filters.language} onChange={(event) => setFilter('language', event.target.value)}><option value={ALL}>All languages</option>{languages.map((value) => <option key={value}>{value}</option>)}</select>
            <select className="form-select" aria-label="Request assignee" value={filters.assignee} onChange={(event) => setFilter('assignee', event.target.value)}><option value={ALL}>All assignees</option><option value="">Unassigned</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select>
        </div>

        {notice.text && <div className={`request-workflow-notice ${notice.tone}`}><AppIcon name={notice.tone === 'success' ? 'CheckCircle2' : 'Activity'} size={15} /><span>{notice.text}</span><button type="button" onClick={() => setNotice({ tone: '', text: '' })} aria-label="Dismiss notice"><AppIcon name="X" size={13} /></button></div>}

        <div className="request-workspace-grid">
            <div className="workflow-request-list">{loading && !requests.length ? <div className="insight-state"><span className="spinner" /><p>Loading shared requests…</p></div> : filtered.length ? filtered.map((request) => <RequestCard key={request.id} request={request} active={selectedId === request.id} onOpen={() => setSelectedId(request.id)} />) : <div className="insight-state"><AppIcon name="SearchX" size={24} /><p>No requests match these filters.</p></div>}</div>
            <aside className="request-detail-drawer">
                {selected && draft ? <>
                    <div className="request-detail-heading"><div><StatusChip status={selected.status} /><h3>{selected.description}</h3><p>{selected.id} · submitted {dateLabel(selected.createdAt)}</p></div>{selected.syncState === 'pending' && <span className="status-pill warning">Sync pending</span>}</div>
                    <div className="request-source-details"><div><small>Topic</small><strong>{selected.topic || 'General'}</strong></div><div><small>Language</small><strong>{selected.requestedLanguage || 'Any'}</strong></div><div><small>Platform</small><strong>{selected.requestedPlatform || 'Either'}</strong></div></div>
                    {selected.context && <div className="request-context"><small>Requester context</small><p>{selected.context}</p></div>}
                    {selected.searchTerms && <div className="request-context"><small>Searched terms</small><p>{selected.searchTerms}</p></div>}
                    <div className="request-edit-grid">
                        <label className="form-group"><span>Status</span><select className="form-select" value={draft.status} onChange={(event) => setDraftField('status', event.target.value)}>{REQUEST_STATUSES.map((status) => <option key={status} value={status}>{REQUEST_STATUS_META[status].label}</option>)}</select></label>
                        <label className="form-group"><span>Assignee</span><select className="form-select" value={draft.assigneeContributorId} onChange={(event) => setDraftField('assigneeContributorId', event.target.value)}><option value="">Unassigned</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
                        <label className="form-group request-linked-guide"><span>Linked published screenshot {['done', 'already_exists'].includes(draft.status) ? '*' : ''}</span><select className="form-select" value={draft.linkedRecordId} onChange={(event) => setDraftField('linkedRecordId', event.target.value)}><option value="">No linked screenshot</option>{items.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={String(item.id)}>{item.title}</option>)}</select></label>
                        <label className="form-group request-resolution"><span>Resolution / update note {draft.status === 'cannot_be_done' ? '*' : ''}</span><textarea className="form-textarea short" value={draft.resolutionNote} onChange={(event) => setDraftField('resolutionNote', event.target.value)} placeholder="Explain the outcome or leave a useful handoff note…" /></label>
                    </div>
                    <div className="request-savebar"><span>Version {selected.version} · {selected.updatedByName ? `last edited by ${selected.updatedByName}` : 'not edited yet'}</span><button type="button" className="button button-primary" disabled={saving} onClick={save}><AppIcon name="Save" size={15} />{saving ? 'Saving…' : 'Save update'}</button></div>
                    <section className="request-history"><div className="panel-heading"><div><span className="eyebrow">Immutable timeline</span><h4>Request history</h4></div><strong>{selected.history.length}</strong></div>{selected.history.length ? selected.history.slice().reverse().map((event) => <article key={event.id}><span className="audit-node"><AppIcon name={event.action === 'created' || event.action === 'imported' ? 'Plus' : 'Activity'} size={13} /></span><div><strong>{String(event.action || 'updated').replaceAll('_', ' ')}</strong><p>{event.actorName || 'Public requester'}</p><time>{dateLabel(event.createdAt)}</time></div></article>) : <p className="request-history-empty">History appears after the live Worker is loaded.</p>}</section>
                </> : <div className="insight-state"><AppIcon name="PanelRightOpen" size={25} /><h3>Select a request</h3><p>Open a request to assign, resolve, or link it.</p></div>}
            </aside>
        </div>
    </section>;
}
