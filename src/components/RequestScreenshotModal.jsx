import React, { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { useData } from '../contexts/DataContext';
import { useRequestModal } from '../contexts/RequestModalContext';
import { createRequestReference } from '../domain/survey';
import { logScreenshotRequest } from '../services/analytics';
import { resolveImageUrl } from '../utils/imageUtils';
import { AppIcon } from './AppIcon';

const TOPIC_OPTIONS = ['Futures Trading', 'Margin Trading', 'Copy Trading', 'LOAN', 'BOTS', 'Grid Bot', 'Event Contract', 'General', 'Binance LOAN'];
const LANGUAGE_OPTIONS = [
    ['EN', 'English'], ['CN', 'Chinese'], ['TR', 'Turkish'], ['AR', 'Arabic'], ['RU', 'Russian'], ['VI', 'Vietnamese'],
];
const RATE_LIMIT_MS = 60 * 1000;
const RATE_LIMIT_KEY = 'fd_last_request_at';

export function RequestScreenshotModal() {
    const { prefillSearch, close } = useRequestModal();
    const { items, allTopics } = useData();
    const [form, setForm] = useState({ topic: '', customTopic: '', language: 'EN', platform: 'Either', description: '', context: '', searchTerms: prefillSearch || '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [reference, setReference] = useState('');
    const [dismissedDuplicates, setDismissedDuplicates] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);
    const dirty = Object.entries(form).some(([key, value]) => key !== 'language' && key !== 'platform' && Boolean(value));

    const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
    const resolvedTopic = form.topic === 'Other' ? form.customTopic.trim() : form.topic;
    const topicOptions = useMemo(() => Array.from(new Set([...TOPIC_OPTIONS, ...allTopics])).sort(), [allTopics]);
    const duplicateFuse = useMemo(() => new Fuse(items, { keys: ['title', 'text', 'text_tr', 'topic'], threshold: 0.3, includeScore: true, ignoreLocation: true }), [items]);
    const duplicates = useMemo(() => {
        if (form.description.trim().length < 10 || dismissedDuplicates) return [];
        return duplicateFuse.search(form.description.trim()).filter((result) => result.score < 0.3).slice(0, 3);
    }, [dismissedDuplicates, duplicateFuse, form.description]);

    const requestClose = () => {
        if (!submitting && dirty && !reference) setConfirmClose(true);
        else if (!submitting) close();
    };

    useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') requestClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const validate = () => {
        if (!resolvedTopic) return 'Choose a topic so the request reaches the right owner.';
        if (form.description.trim().length < 10) return 'Describe the screenshot using at least 10 characters.';
        if (form.context.length > 300) return 'Additional context must be 300 characters or fewer.';
        return '';
    };

    const checkRateLimit = () => {
        try {
            const last = Number(localStorage.getItem(RATE_LIMIT_KEY) || 0);
            const remaining = RATE_LIMIT_MS - (Date.now() - last);
            return last && remaining > 0 ? `Please wait ${Math.ceil(remaining / 1000)} seconds before sending another request.` : '';
        } catch { return ''; }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const validation = validate() || checkRateLimit();
        if (validation) { setError(validation); return; }
        setError('');
        setSubmitting(true);
        try {
            await logScreenshotRequest({
                topic: resolvedTopic,
                language: form.language,
                platform: form.platform,
                description: form.description.trim(),
                context: form.context.trim(),
                search_terms: form.searchTerms.trim(),
            });
            try { localStorage.setItem(RATE_LIMIT_KEY, String(Date.now())); } catch { /* private browsing */ }
            setReference(createRequestReference());
        } catch (requestError) {
            setError(requestError.message || 'The request could not be sent. Your text is still here; please retry.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay sheet-overlay" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
            <section className="modal-content request-modal request-sheet" role="dialog" aria-modal="true" aria-labelledby="request-title">
                <div className="modal-header request-sheet-head">
                    <div>
                        <span className="eyebrow"><AppIcon name="ImagePlus" size={13} /> Library request</span>
                        <h2 className="modal-title" id="request-title">Request a screenshot</h2>
                        <p className="survey-subtitle">Tell us what is missing. We will route it with your search context.</p>
                    </div>
                    <button type="button" className="close-btn" onClick={requestClose} disabled={submitting} aria-label="Close request"><AppIcon name="X" /></button>
                </div>

                {reference ? (
                    <div className="request-success">
                        <div className="request-success-icon"><AppIcon name="Check" size={34} /></div>
                        <span className="eyebrow">Request recorded</span>
                        <h4>Thanks for flagging the gap.</h4>
                        <p>Your request is in the content queue. Keep this reference if you need to follow up.</p>
                        <code className="request-reference">{reference}</code>
                        <button type="button" className="button button-primary" onClick={close}>Back to library</button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="sheet-form">
                        <div className="modal-body">
                            {duplicates.length > 0 && (
                                <div className="duplicate-warning">
                                    <div className="duplicate-heading"><AppIcon name="Search" size={16} /><strong>Check these existing guides first</strong></div>
                                    <p>We found close matches while you typed.</p>
                                    <ul className="duplicate-list">
                                        {duplicates.map(({ item }) => (
                                            <li key={item.id} className="duplicate-item">
                                                <img src={resolveImageUrl(item.image)} alt="" loading="lazy" />
                                                <span><strong>{item.title}</strong><small>{item.topic} · {item.language}</small></span>
                                                <button type="button" className="dup-use-btn" onClick={close}>Use this</button>
                                            </li>
                                        ))}
                                    </ul>
                                    <button type="button" className="dup-override" onClick={() => setDismissedDuplicates(true)}>None match — continue my request</button>
                                </div>
                            )}

                            <div className="form-section">
                                <div className="form-section-title"><span>01</span><div><strong>Classify the request</strong><small>Helps the right content owner find it quickly.</small></div></div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Topic <span className="req-star">Required</span></label>
                                        <select className="form-select" value={form.topic} onChange={(event) => setField('topic', event.target.value)}>
                                            <option value="">Choose topic</option>
                                            {topicOptions.map((topic) => <option value={topic} key={topic}>{topic}</option>)}
                                            <option value="Other">Other</option>
                                        </select>
                                        {form.topic === 'Other' && <input className="form-input" value={form.customTopic} maxLength={60} onChange={(event) => setField('customTopic', event.target.value)} placeholder="New topic name" />}
                                    </div>
                                    <div className="form-group">
                                        <label>Language</label>
                                        <select className="form-select" value={form.language} onChange={(event) => setField('language', event.target.value)}>
                                            {LANGUAGE_OPTIONS.map(([code, label]) => <option value={code} key={code}>{label} ({code})</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Platform</label>
                                    <div className="seg-control request-segments">
                                        {['Web', 'Mobile', 'Either'].map((platform) => <button type="button" key={platform} className={`seg-btn ${form.platform === platform ? 'active' : ''}`} onClick={() => setField('platform', platform)}>{platform}</button>)}
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <div className="form-section-title"><span>02</span><div><strong>Describe the missing guide</strong><small>Specific pathways are easier to capture accurately.</small></div></div>
                                <div className="form-group">
                                    <label>What should the screenshot show? <span className="char-count">{form.description.trim().length}/500</span></label>
                                    <textarea className="form-textarea" value={form.description} maxLength={500} onChange={(event) => setField('description', event.target.value)} placeholder="Example: Show the new mobile pathway for enabling BNB fee discount…" />
                                </div>
                                <div className="form-group">
                                    <label>Why do you need it? <span className="char-count">{form.context.length}/300</span></label>
                                    <textarea className="form-textarea short" value={form.context} maxLength={300} onChange={(event) => setField('context', event.target.value)} placeholder="Optional frequency or customer context" />
                                </div>
                                <div className="form-group">
                                    <label>Terms you already searched</label>
                                    <input className="form-input" value={form.searchTerms} onChange={(event) => setField('searchTerms', event.target.value)} placeholder="Your Library search terms" />
                                </div>
                            </div>

                            {error && <div className="request-error"><AppIcon name="Activity" size={16} /><span>{error}</span></div>}
                        </div>
                        <div className="modal-footer">
                            <span className="footer-hint">Public request · no publishing access</span>
                            <div className="footer-actions">
                                <button type="button" className="button button-quiet" onClick={requestClose} disabled={submitting}>Cancel</button>
                                <button type="submit" className="button button-primary" disabled={submitting}><AppIcon name="MessageSquarePlus" size={15} /> {submitting ? 'Sending…' : 'Send request'}</button>
                            </div>
                        </div>
                    </form>
                )}

                {confirmClose && (
                    <div className="discard-banner" role="alertdialog" aria-label="Discard request draft">
                        <div><strong>Discard this request?</strong><span>Your entered details will be lost.</span></div>
                        <div><button type="button" className="button button-quiet" onClick={() => setConfirmClose(false)}>Keep editing</button><button type="button" className="button button-danger" onClick={close}>Discard</button></div>
                    </div>
                )}
            </section>
        </div>
    );
}
