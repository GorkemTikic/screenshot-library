import React, { useMemo, useState } from 'react';
import { AppIcon } from '../AppIcon';
import { buildPatch, TOPIC_META } from '../../domain/catalog';
import { contentApi, ContentApiError } from '../../services/contentApi';
import { useAuth } from '../../contexts/AuthContext';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { ConflictResolver } from '../ConflictResolver';
import { ImageReplaceField } from './ImageReplaceField';

const FIELDS = ['title', 'text', 'text_tr', 'topic', 'language', 'platform'];
const LANGUAGES = ['English', 'Chinese', 'Arabic', 'Russian', 'Vietnamese', 'Multi-Language'];

function initialDraft(item) {
    return item ? Object.fromEntries(FIELDS.map((field) => [field, item[field] || (field === 'platform' ? 'mobile' : '')])) : {
        title: '', text: '', text_tr: '', topic: 'General', language: 'English', platform: 'mobile',
    };
}

export function ContentEditor({ item, onClose, onPublished }) {
    const auth = useAuth();
    const [base, setBase] = useState(item || null);
    const [draft, setDraft] = useState(() => initialDraft(item));
    const [image, setImage] = useState(null);
    const [languageTab, setLanguageTab] = useState('source');
    const [status, setStatus] = useState({ state: 'idle', message: '' });
    const [conflict, setConflict] = useState(null);
    const patch = useMemo(() => buildPatch(base || initialDraft(null), draft, FIELDS), [base, draft]);
    const dirty = Boolean(image) || Object.keys(patch).length > 0;
    useUnsavedChanges(dirty);

    const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
    const close = () => { if (!dirty || window.confirm('Discard your unpublished changes?')) onClose(); };

    const publish = async (override = null) => {
        if (!draft.title.trim() || !draft.text.trim() || !draft.topic || !draft.language) return setStatus({ state: 'error', message: 'Title, source response, topic and language are required.' });
        if (!item && !image) return setStatus({ state: 'error', message: 'Choose a screenshot image before publishing.' });
        setStatus({ state: 'publishing', message: 'Validating and publishing…' });
        const payload = override || {
            action: item ? (image && !Object.keys(patch).length ? 'replace-image' : 'update') : 'create',
            recordId: item?.id,
            baseRecord: base || undefined,
            patch: item ? patch : draft,
        };
        try {
            const result = await contentApi.publish(payload, image);
            setBase(result.record);
            setStatus({ state: 'success', message: 'Published safely. The Library is now using this version.' });
            onPublished(result.record);
            window.setTimeout(onClose, 650);
        } catch (error) {
            if (error instanceof ContentApiError && error.status === 409 && error.conflicts) {
                setConflict({ conflicts: error.conflicts, latest: error.latest });
                setStatus({ state: 'idle', message: '' });
            } else setStatus({ state: 'error', message: `${error.message}${error.requestId ? ` · Request ${error.requestId}` : ''}` });
        }
    };

    const resolve = (choices, latest) => {
        const resolvedDraft = { ...draft };
        Object.entries(choices).forEach(([field, choice]) => { if (choice === 'latest') resolvedDraft[field] = latest[field] || ''; });
        const resolvedPatch = buildPatch(latest, resolvedDraft, FIELDS);
        setDraft(resolvedDraft); setBase(latest); setConflict(null);
        publish({ action: 'resolve-conflict', recordId: item.id, baseRecord: latest, patch: resolvedPatch });
    };

    const archive = async () => {
        if (!window.confirm(`Archive “${item.title}”? It will disappear from the public Library but remain recoverable in history.`)) return;
        setStatus({ state: 'publishing', message: 'Archiving…' });
        try {
            const result = await contentApi.publish({ action: 'archive', recordId: item.id, baseRecord: base, patch: {} });
            onPublished(result.record); onClose();
        } catch (error) { setStatus({ state: 'error', message: error.message }); }
    };

    return <>
        <div className="modal-overlay editor-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}>
            <section className="studio-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
                <header className="studio-editor-header"><div><span className="eyebrow">{item ? `Screenshot · ${item.id}` : 'New catalog entry'}</span><h2 id="editor-title">{item ? 'Edit published guide' : 'Create screenshot guide'}</h2></div><button type="button" className="icon-button" onClick={close} aria-label="Close editor"><AppIcon name="X" /></button></header>
                <div className="studio-editor-body">
                    <section className="editor-column editor-main">
                        <div className="editor-section-heading"><div><strong>Screenshot asset</strong><span>Replace safely without exposing GitHub credentials</span></div>{image && <span className="status-pill positive"><AppIcon name="Check" size={12} /> Ready</span>}</div>
                        <ImageReplaceField currentImage={item?.image} file={image} onChange={setImage} />
                        <div className="editor-section-heading"><div><strong>Response copy</strong><span>Edit both service languages in one place</span></div><div className="language-editor-tabs"><button type="button" className={languageTab === 'source' ? 'active' : ''} onClick={() => setLanguageTab('source')}>EN / Source</button><button type="button" className={languageTab === 'tr' ? 'active' : ''} onClick={() => setLanguageTab('tr')}>TR</button></div></div>
                        {languageTab === 'source' ? <label className="form-group"><span>Source response *</span><textarea className="form-textarea editor-copy" value={draft.text} onChange={(event) => update('text', event.target.value)} placeholder="Step-by-step response shown when the user copies EN…" /></label> : <label className="form-group"><span>Turkish response</span><textarea className="form-textarea editor-copy" value={draft.text_tr} onChange={(event) => update('text_tr', event.target.value)} placeholder="Türkçe yanıt metni…" /></label>}
                    </section>
                    <aside className="editor-column editor-details">
                        <div className="editor-section-heading"><div><strong>Catalog details</strong><span>How this guide is found and credited</span></div></div>
                        <label className="form-group"><span>Title *</span><input className="form-input" value={draft.title} onChange={(event) => update('title', event.target.value)} maxLength={240} /></label>
                        <div className="form-row"><label className="form-group"><span>Topic *</span><select className="form-select" value={draft.topic} onChange={(event) => update('topic', event.target.value)}>{Object.keys(TOPIC_META).map((topic) => <option key={topic}>{topic}</option>)}</select></label><label className="form-group"><span>Language *</span><select className="form-select" value={draft.language} onChange={(event) => update('language', event.target.value)}>{LANGUAGES.map((language) => <option key={language}>{language}</option>)}</select></label></div>
                        <div className="form-group"><span>Platform *</span><div className="editor-segments">{['mobile', 'web'].map((value) => <button type="button" key={value} className={draft.platform === value ? 'active' : ''} onClick={() => update('platform', value)}><AppIcon name={value === 'mobile' ? 'Smartphone' : 'Monitor'} size={15} />{value === 'mobile' ? 'Mobile app' : 'Web desktop'}</button>)}</div></div>
                        {item && <div className="publish-summary"><div><AppIcon name="UserRound" size={16} /><span><strong>{item.owner}</strong><small>Ownership transfers only when the screenshot image is replaced.</small></span></div></div>}
                        <div className="publish-summary"><div><AppIcon name="ShieldCheck" size={16} /><span><strong>Atomic publishing</strong><small>Your text and image become one version. Concurrent edits are merged when safe.</small></span></div><div><AppIcon name="UserRound" size={16} /><span><strong>{auth.principal.displayName}</strong><small>Will be recorded in the audit trail</small></span></div></div>
                    </aside>
                </div>
                {status.message && <div className={`editor-status ${status.state}`}><AppIcon name={status.state === 'success' ? 'CheckCircle2' : 'Activity'} size={15} />{status.message}</div>}
                <footer className="studio-editor-footer"><div>{item && auth.isOwner && <button type="button" className="button button-danger" onClick={archive} disabled={status.state === 'publishing'}><AppIcon name="Archive" size={15} /> Archive</button>}</div><div><button type="button" className="button button-quiet" onClick={close}>Cancel</button><button type="button" className="button button-primary" onClick={() => publish()} disabled={status.state === 'publishing' || !dirty}><AppIcon name="Save" size={15} />{status.state === 'publishing' ? 'Publishing…' : item ? 'Publish update' : 'Publish screenshot'}</button></div></footer>
            </section>
        </div>
        {conflict && <ConflictResolver conflict={conflict} onResolve={resolve} onCancel={() => setConflict(null)} />}
    </>;
}
