import React, { useEffect, useMemo, useState } from 'react';
import { X, Send, CheckCircle, AlertTriangle, ClipboardList, Star } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useSurveyModal } from '../contexts/SurveyModalContext';
import { logSurveyResponse } from '../services/analytics';

const USAGE_OPTIONS = [
    'Never',
    'Rarely (a few times a month)',
    '1–5 times per shift',
    '6–20 times per shift',
    '20+ times per shift',
];

const PLATFORM_PREF_OPTIONS = ['Web', 'Mobile', 'Both equally'];

const REQUEST_EXPERIENCE_OPTIONS = [
    { value: 'used_worked',          label: 'Yes — I used it and it worked' },
    { value: 'used_did_not_work',    label: "Yes — I used it but it didn't work well" },
    { value: 'did_not_know',         label: "No — I didn't know the feature existed" },
    { value: 'did_not_need',         label: "No — I haven't needed it yet" },
];

const LANGUAGE_OPTIONS = [
    { code: 'EN', label: 'English' },
    { code: 'CN', label: 'Chinese' },
    { code: 'TR', label: 'Turkish' },
    { code: 'AR', label: 'Arabic' },
    { code: 'RU', label: 'Russian' },
    { code: 'VI', label: 'Vietnamese' },
];

const BUILT_IN_TOPICS = [
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

const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_KEY = 'fd_last_survey_at';

function RatingStars({ value, onChange, ariaLabel }) {
    return (
        <div className="rating-stars" role="radiogroup" aria-label={ariaLabel}>
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    type="button"
                    key={n}
                    role="radio"
                    aria-checked={value === n}
                    className={`rating-star ${value >= n ? 'filled' : ''}`}
                    onClick={() => onChange(n)}
                    title={`${n} star${n > 1 ? 's' : ''}`}
                >
                    <Star size={22} />
                </button>
            ))}
        </div>
    );
}

export function SurveyModal() {
    const { close } = useSurveyModal();
    const { allTopics } = useData();

    const [usageFrequency, setUsageFrequency] = useState('');
    const [satisfaction, setSatisfaction] = useState(0);
    const [searchEase, setSearchEase] = useState(0);
    const [underCoveredTopic, setUnderCoveredTopic] = useState('');
    const [customTopic, setCustomTopic] = useState('');
    const [languagesNeeded, setLanguagesNeeded] = useState([]);
    const [platformPreference, setPlatformPreference] = useState('');
    const [requestExperience, setRequestExperience] = useState('');
    const [topFeature, setTopFeature] = useState('');
    const [biggestFrustration, setBiggestFrustration] = useState('');
    const [otherFeedback, setOtherFeedback] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [rateLimitMsg, setRateLimitMsg] = useState('');

    const effectiveTopicOptions = useMemo(() => {
        const merged = new Set([...BUILT_IN_TOPICS, ...(allTopics || [])]);
        return Array.from(merged).sort();
    }, [allTopics]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !submitting) close(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [submitting, close]);

    const resolvedTopic = underCoveredTopic === 'Other' ? customTopic.trim() : underCoveredTopic;

    const toggleLanguage = (code) => {
        setLanguagesNeeded(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        );
    };

    const validate = () => {
        if (!usageFrequency) return 'Please answer Q1 — how often you use it.';
        if (!satisfaction) return 'Please rate Q2 — your satisfaction.';
        if (!searchEase) return 'Please rate Q3 — search ease.';
        if (!resolvedTopic) return 'Please pick the most under-covered topic in Q4.';
        if (languagesNeeded.length === 0) return 'Please pick at least one language in Q5.';
        if (!platformPreference) return 'Please answer Q6 — platform preference.';
        if (!requestExperience) return 'Please answer Q7 — Request Screenshot experience.';
        if (topFeature.trim().length < 3) return 'Please tell us your top feature idea in Q8 (at least 3 characters).';
        if (topFeature.length > 300) return 'Q8 must be 300 characters or fewer.';
        if (biggestFrustration.trim().length < 3) return 'Please share your biggest frustration in Q9 (at least 3 characters).';
        if (biggestFrustration.length > 300) return 'Q9 must be 300 characters or fewer.';
        if (otherFeedback.length > 500) return 'Q10 must be 500 characters or fewer.';
        return '';
    };

    const checkRateLimit = () => {
        try {
            const last = parseInt(localStorage.getItem(RATE_LIMIT_KEY) || '0', 10);
            const elapsed = Date.now() - last;
            if (last && elapsed < RATE_LIMIT_MS) {
                const hours = Math.ceil((RATE_LIMIT_MS - elapsed) / (60 * 60 * 1000));
                return `You already submitted a survey recently. Please wait about ${hours}h before submitting again.`;
            }
        } catch { /* ignore */ }
        return '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');
        setRateLimitMsg('');

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
            await logSurveyResponse({
                usage_frequency: usageFrequency,
                satisfaction,
                search_ease: searchEase,
                under_covered_topic: resolvedTopic,
                languages_needed: languagesNeeded.join(','),
                platform_preference: platformPreference,
                request_feature_experience: requestExperience,
                top_feature: topFeature.trim(),
                biggest_frustration: biggestFrustration.trim(),
                other_feedback: otherFeedback.trim(),
            });
            localStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));
            setSubmitSuccess(true);
            setTimeout(() => {
                close();
            }, 2000);
        } catch (err) {
            setSubmitError(err.message || 'Something went wrong. Please try again.');
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={() => !submitting && close()}>
            <div className="modal-content survey-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="survey-header-title">
                        <ClipboardList size={20} className="survey-header-icon" />
                        <div>
                            <h3 className="modal-title">Agent Feedback Survey</h3>
                            <p className="survey-subtitle">10 quick questions — takes about 3 minutes.</p>
                        </div>
                    </div>
                    <button className="close-btn modal-close" onClick={close} disabled={submitting} aria-label="Close">
                        <X size={22} />
                    </button>
                </div>

                {submitSuccess ? (
                    <div className="request-success">
                        <div className="request-success-icon">
                            <CheckCircle size={48} />
                        </div>
                        <h4>Thanks for the feedback!</h4>
                        <p>Your answers have been recorded. This helps shape what we build next.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body survey-body">
                            {/* Q1 */}
                            <div className="survey-q">
                                <label className="survey-q-label">
                                    <span className="survey-q-num">Q1</span>
                                    How often do you use the Screenshot Assistant during your shift?
                                </label>
                                <div className="survey-options">
                                    {USAGE_OPTIONS.map(opt => (
                                        <button
                                            type="button"
                                            key={opt}
                                            className={`survey-chip ${usageFrequency === opt ? 'active' : ''}`}
                                            onClick={() => setUsageFrequency(opt)}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Q2 */}
                            <div className="survey-q">
                                <label className="survey-q-label">
                                    <span className="survey-q-num">Q2</span>
                                    How satisfied are you with the current library?
                                </label>
                                <RatingStars value={satisfaction} onChange={setSatisfaction} ariaLabel="Satisfaction rating" />
                            </div>

                            {/* Q3 */}
                            <div className="survey-q">
                                <label className="survey-q-label">
                                    <span className="survey-q-num">Q3</span>
                                    How easy is it to find the screenshot you need via search?
                                </label>
                                <RatingStars value={searchEase} onChange={setSearchEase} ariaLabel="Search ease rating" />
                            </div>

                            {/* Q4 */}
                            <div className="survey-q">
                                <label className="survey-q-label">
                                    <span className="survey-q-num">Q4</span>
                                    Which topic area feels <strong>most under-covered</strong>?
                                </label>
                                <select
                                    className="form-select"
                                    value={underCoveredTopic}
                                    onChange={(e) => setUnderCoveredTopic(e.target.value)}
                                >
                                    <option value="">Select a topic...</option>
                                    {effectiveTopicOptions.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                    <option value="Other">Other…</option>
                                </select>
                                {underCoveredTopic === 'Other' && (
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

                            {/* Q5 */}
                            <div className="survey-q">
                                <label className="survey-q-label">
                                    <span className="survey-q-num">Q5</span>
                                    Which languages need more coverage? <span className="survey-hint">(select all that apply)</span>
                                </label>
                                <div className="survey-options">
                                    {LANGUAGE_OPTIONS.map(l => (
                                        <button
                                            type="button"
                                            key={l.code}
                                            className={`survey-chip ${languagesNeeded.includes(l.code) ? 'active' : ''}`}
                                            onClick={() => toggleLanguage(l.code)}
                                        >
                                            {l.label} ({l.code})
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Q6 */}
                            <div className="survey-q">
                                <label className="survey-q-label">
                                    <span className="survey-q-num">Q6</span>
                                    Do you prefer Web, Mobile, or both for screenshots?
                                </label>
                                <div className="seg-control">
                                    {PLATFORM_PREF_OPTIONS.map(opt => (
                                        <button
                                            type="button"
                                            key={opt}
                                            className={`seg-btn ${platformPreference === opt ? 'active' : ''}`}
                                            onClick={() => setPlatformPreference(opt)}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Q7 */}
                            <div className="survey-q">
                                <label className="survey-q-label">
                                    <span className="survey-q-num">Q7</span>
                                    Have you used the <strong>Request Screenshot</strong> feature?
                                </label>
                                <div className="survey-options survey-options-stack">
                                    {REQUEST_EXPERIENCE_OPTIONS.map(opt => (
                                        <button
                                            type="button"
                                            key={opt.value}
                                            className={`survey-chip ${requestExperience === opt.value ? 'active' : ''}`}
                                            onClick={() => setRequestExperience(opt.value)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Q8 */}
                            <div className="survey-q">
                                <label className="survey-q-label">
                                    <span className="survey-q-num">Q8</span>
                                    What's the #1 feature you'd add?
                                    <span className="char-count">{topFeature.length}/300</span>
                                </label>
                                <textarea
                                    className="form-textarea short"
                                    placeholder="e.g., bulk download, annotations, shortcut keys…"
                                    value={topFeature}
                                    onChange={(e) => setTopFeature(e.target.value)}
                                    maxLength={300}
                                />
                            </div>

                            {/* Q9 */}
                            <div className="survey-q">
                                <label className="survey-q-label">
                                    <span className="survey-q-num">Q9</span>
                                    What frustrates you most today?
                                    <span className="char-count">{biggestFrustration.length}/300</span>
                                </label>
                                <textarea
                                    className="form-textarea short"
                                    placeholder="e.g., search doesn't find X, mobile screenshots are missing for Y…"
                                    value={biggestFrustration}
                                    onChange={(e) => setBiggestFrustration(e.target.value)}
                                    maxLength={300}
                                />
                            </div>

                            {/* Q10 */}
                            <div className="survey-q">
                                <label className="survey-q-label">
                                    <span className="survey-q-num">Q10</span>
                                    Any other ideas or feedback? <span className="survey-hint">(optional)</span>
                                    <span className="char-count">{otherFeedback.length}/500</span>
                                </label>
                                <textarea
                                    className="form-textarea short"
                                    placeholder="Anything else you want us to know?"
                                    value={otherFeedback}
                                    onChange={(e) => setOtherFeedback(e.target.value)}
                                    maxLength={500}
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
                                    <><Send size={16} /> Submit Survey</>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
