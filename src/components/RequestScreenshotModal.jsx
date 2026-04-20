import React, { useState, useEffect, useMemo } from 'react';
import { X, Send, CheckCircle, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import Fuse from 'fuse.js';
import { useData } from '../contexts/DataContext';
import { useRequestModal } from '../contexts/RequestModalContext';
import { logScreenshotRequest } from '../services/analytics';

const TOPIC_OPTIONS = [
    'Futures Trading',
    'Margin Trading',
    'Copy Trading',
    'LOAN',
    'BOTS',
    'Grid Bot',
    'Event Contract',
    'General',
    'Binance LOAN',
];

const LANGUAGE_OPTIONS = [
    { code: 'EN', label: 'English' },
    { code: 'CN', label: 'Chinese' },
    { code: 'TR', label: 'Turkish' },
    { code: 'AR', label: 'Arabic' },
    { code: 'RU', label: 'Russian' },
    { code: 'VI', label: 'Vietnamese' },
];

const RATE_LIMIT_MS = 60 * 1000;
const RATE_LIMIT_KEY = 'fd_last_request_at';

export function RequestScreenshotModal() {
    const { prefillSearch, close } = useRequestModal();
    const { items, allTopics } = useData();

    const [topic, setTopic] = useState('');
    const [customTopic, setCustomTopic] = useState('');
    const [language, setLanguage] = useState('EN');
    const [platform, setPlatform] = useState('Either');
    const [description, setDescription] = useState('');
    const [context, setContext] = useState('');
    const [searchTerms, setSearchTerms] = useState(prefillSearch || '');

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [rateLimitMsg, setRateLimitMsg] = useState('');
    const [dismissedDuplicates, setDismissedDuplicates] = useState(false);

    const effectiveTopicOptions = useMemo(() => {
        const merged = new Set([...TOPIC_OPTIONS, ...(allTopics || [])]);
        return Array.from(merged).sort();
    }, [allTopics]);

    const duplicateFuse = useMemo(() => {
        if (!items || items.length === 0) return null;
        return new Fuse(items, { keys: ['title', 'text', 'topic'], threshold: 0.3, includeScore: true });
    }, [items]);

    const duplicateMatches = useMemo(() => {
        if (!duplicateFuse || description.trim().length < 10 || dismissedDuplicates) return [];
        const results = duplicateFuse.search(description.trim()).slice(0, 3);
        return results.filter(r => r.score !== undefined && r.score < 0.3);
    }, [duplicateFuse, description, dismissedDuplicates]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !submitting) close(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [submitting, close]);

    const resolvedTopic = topic === 'Other' ? customTopic.trim() : topic;
    const descLen = description.trim().length;

    const validate = () => {
        if (!resolvedTopic) return 'Please pick a topic.';
        if (!language) return 'Please pick a language.';
        if (descLen < 10) return 'Description needs at least 10 characters.';
        if (descLen > 500) return 'Description must be 500 characters or fewer.';
        if (context && context.length > 300) return 'Context must be 300 characters or fewer.';
        return '';
    };

    const checkRateLimit = () => {
        try {
            const last = parseInt(localStorage.getItem(RATE_LIMIT_KEY) || '0', 10);
            const elapsed = Date.now() - last;
            if (last && elapsed < RATE_LIMIT_MS) {
                const seconds = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
                return `Please wait ${seconds}s before sending another request.`;
            }
        } catch { /* ignore */ }
        return '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');

        const validation = validate();
        if (validation) {
            setSubmitError(validation);
            return;
        }

        const rate = checkRateLimit();
        if (rate) {
            setRateLimitMsg(rate);
            return;
        }

        setSubmitting(true);
        try {
            await logScreenshotRequest({
                topic: resolvedTopic,
                language,
                platform,
                description: description.trim(),
                context: context.trim(),
                search_terms: searchTerms.trim(),
            });
            localStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));
            setSubmitSuccess(true);
            setTimeout(() => {
                close();
            }, 1800);
        } catch (err) {
            setSubmitError(err.message || 'Something went wrong. Please try again.');
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={() => !submitting && close()}>
            <div className="modal-content request-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Request a Screenshot</h3>
                    <button className="close-btn modal-close" onClick={close} disabled={submitting} aria-label="Close">
                        <X size={22} />
                    </button>
                </div>

                {submitSuccess ? (
                    <div className="request-success">
                        <div className="request-success-icon">
                            <CheckCircle size={48} />
                        </div>
                        <h4>Request sent</h4>
                        <p>Thanks for flagging this. We'll add it to the library.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body">
                            {duplicateMatches.length > 0 && (
                                <div className="dup-panel">
                                    <div className="dup-header">
                                        <ImageIcon size={18} />
                                        <strong>Did you mean one of these existing screenshots?</strong>
                                    </div>
                                    <ul className="dup-list">
                                        {duplicateMatches.map(({ item }) => (
                                            <li key={item.id} className="dup-item">
                                                {item.image && (
                                                    <img src={item.image} alt={item.title} className="dup-thumb" loading="lazy" />
                                                )}
                                                <div className="dup-meta">
                                                    <div className="dup-title">{item.title}</div>
                                                    <div className="dup-sub">
                                                        <span>{item.topic || 'General'}</span>
                                                        <span>•</span>
                                                        <span>{item.language}</span>
                                                    </div>
                                                </div>
                                                <button type="button" className="btn dup-dismiss" onClick={close}>
                                                    Use this
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    <button type="button" className="dup-override" onClick={() => setDismissedDuplicates(true)}>
                                        None of these — send my request anyway
                                    </button>
                                </div>
                            )}

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Topic <span className="req-star">*</span></label>
                                    <select
                                        className="form-select"
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        required
                                    >
                                        <option value="">Select a topic...</option>
                                        {effectiveTopicOptions.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                        <option value="Other">Other…</option>
                                    </select>
                                    {topic === 'Other' && (
                                        <input
                                            type="text"
                                            className="form-input mt-2"
                                            placeholder="Enter topic"
                                            value={customTopic}
                                            onChange={(e) => setCustomTopic(e.target.value)}
                                            maxLength={60}
                                        />
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>Language <span className="req-star">*</span></label>
                                    <select
                                        className="form-select"
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        required
                                    >
                                        {LANGUAGE_OPTIONS.map(l => (
                                            <option key={l.code} value={l.code}>{l.label} ({l.code})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Platform</label>
                                <div className="seg-control">
                                    {['Web', 'Mobile', 'Either'].map(opt => (
                                        <button
                                            type="button"
                                            key={opt}
                                            className={`seg-btn ${platform === opt ? 'active' : ''}`}
                                            onClick={() => setPlatform(opt)}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>
                                    What should the screenshot show? <span className="req-star">*</span>
                                    <span className="char-count">{descLen}/500</span>
                                </label>
                                <textarea
                                    className="form-textarea short"
                                    placeholder="e.g., how to enable the BNB discount on the mobile app settings page"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    maxLength={500}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>
                                    Why you need it / how often you hit this
                                    <span className="char-count">{context.length}/300</span>
                                </label>
                                <textarea
                                    className="form-textarea short"
                                    placeholder="e.g., I get this question 2-3 times per shift and there's no existing screenshot for the new UI"
                                    value={context}
                                    onChange={(e) => setContext(e.target.value)}
                                    maxLength={300}
                                />
                            </div>

                            <div className="form-group">
                                <label>Your current search terms</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="What did you search for?"
                                    value={searchTerms}
                                    onChange={(e) => setSearchTerms(e.target.value)}
                                />
                            </div>

                            {(submitError || rateLimitMsg) && (
                                <div className="request-error">
                                    <AlertTriangle size={16} />
                                    <span>{submitError || rateLimitMsg}</span>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={close} disabled={submitting}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? (
                                    <>Sending…</>
                                ) : (
                                    <><Send size={16} /> Send Request</>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
