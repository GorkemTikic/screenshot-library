import React, { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useSurveyModal } from '../contexts/SurveyModalContext';
import { emptySurvey, sanitizeSurveyDraft, validateSurveySection } from '../domain/survey';
import { logSurveyResponse } from '../services/analytics';
import { AppIcon } from './AppIcon';

const DRAFT_KEY = 'fd_survey_draft_v1';
const RATE_LIMIT_KEY = 'fd_last_survey_at';
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;
const USAGE_OPTIONS = ['Never', 'Rarely (a few times a month)', '1–5 times per shift', '6–20 times per shift', '20+ times per shift'];
const PLATFORM_OPTIONS = ['Web', 'Mobile', 'Both equally'];
const REQUEST_OPTIONS = [
    ['used_worked', 'Used it — worked well'],
    ['used_did_not_work', 'Used it — needs improvement'],
    ['did_not_know', 'I did not know it existed'],
    ['did_not_need', 'I have not needed it'],
];
const LANGUAGE_OPTIONS = [['EN', 'English'], ['CN', 'Chinese'], ['TR', 'Turkish'], ['AR', 'Arabic'], ['RU', 'Russian'], ['VI', 'Vietnamese']];
const BUILT_IN_TOPICS = ['Futures Trading', 'Margin Trading', 'Copy Trading', 'LOAN', 'BOTS', 'Grid Bot', 'Event Contract', 'General', 'Binance LOAN'];
const STEP_TITLES = ['Usage & satisfaction', 'Coverage needs', 'Ideas & friction', 'Review'];

function loadDraft() {
    try { return sanitizeSurveyDraft(JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}')); }
    catch { return { ...emptySurvey }; }
}

function RatingScale({ label, value, onChange }) {
    return (
        <div className="rating-scale" role="radiogroup" aria-label={label}>
            {[1, 2, 3, 4, 5].map((rating) => (
                <button type="button" key={rating} role="radio" aria-checked={value === rating} className={`rating-card ${value === rating ? 'active' : ''}`} onClick={() => onChange(rating)}>
                    <Star size={17} fill={value >= rating ? 'currentColor' : 'none'} />
                    <strong>{rating}</strong>
                    <small>{rating === 1 ? 'Low' : rating === 5 ? 'Excellent' : ''}</small>
                </button>
            ))}
        </div>
    );
}

export function SurveyModal() {
    const { close } = useSurveyModal();
    const { allTopics } = useData();
    const [survey, setSurvey] = useState(loadDraft);
    const [step, setStep] = useState(0);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);
    const topicOptions = useMemo(() => Array.from(new Set([...BUILT_IN_TOPICS, ...allTopics])).sort(), [allTopics]);
    const dirty = JSON.stringify(survey) !== JSON.stringify(emptySurvey);
    const setField = (field, value) => setSurvey((current) => ({ ...current, [field]: value }));
    const resolvedTopic = survey.underCoveredTopic === 'Other' ? survey.customTopic.trim() : survey.underCoveredTopic;

    useEffect(() => {
        if (!success) {
            try { localStorage.setItem(DRAFT_KEY, JSON.stringify(survey)); } catch { /* private browsing */ }
        }
    }, [success, survey]);

    const requestClose = () => {
        if (!submitting && dirty && !success) setConfirmClose(true);
        else if (!submitting) close();
    };

    useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') requestClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const next = () => {
        const validation = validateSurveySection(step, survey);
        if (validation) { setError(validation); return; }
        setError('');
        setStep((current) => Math.min(3, current + 1));
    };

    const toggleLanguage = (code) => setField('languagesNeeded', survey.languagesNeeded.includes(code)
        ? survey.languagesNeeded.filter((value) => value !== code)
        : [...survey.languagesNeeded, code]);

    const checkRateLimit = () => {
        try {
            const last = Number(localStorage.getItem(RATE_LIMIT_KEY) || 0);
            const remaining = RATE_LIMIT_MS - (Date.now() - last);
            return last && remaining > 0 ? `You already submitted recently. Please wait about ${Math.ceil(remaining / 3600000)} hours.` : '';
        } catch { return ''; }
    };

    const submit = async () => {
        const sectionError = validateSurveySection(2, survey) || checkRateLimit();
        if (sectionError) { setError(sectionError); setStep(2); return; }
        setError('');
        setSubmitting(true);
        try {
            await logSurveyResponse({
                usage_frequency: survey.usageFrequency,
                satisfaction: survey.satisfaction,
                search_ease: survey.searchEase,
                under_covered_topic: resolvedTopic,
                languages_needed: survey.languagesNeeded.join(','),
                platform_preference: survey.platformPreference,
                request_feature_experience: survey.requestExperience,
                top_feature: survey.topFeature.trim(),
                biggest_frustration: survey.biggestFrustration.trim(),
                other_feedback: survey.otherFeedback.trim(),
            });
            localStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));
            localStorage.removeItem(DRAFT_KEY);
            setSuccess(true);
        } catch (submitError) {
            setError(submitError.message || 'The survey could not be submitted. Your draft remains saved.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay survey-overlay" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
            <section className="modal-content survey-modal survey-workspace" role="dialog" aria-modal="true" aria-labelledby="survey-title">
                <header className="modal-header survey-workspace-head">
                    <div>
                        <span className="eyebrow"><AppIcon name="ClipboardList" size={13} /> Agent voice</span>
                        <h2 className="modal-title" id="survey-title">Feedback survey</h2>
                        <p className="survey-subtitle">Ten focused questions · draft saved automatically</p>
                    </div>
                    <button type="button" className="close-btn" onClick={requestClose} disabled={submitting} aria-label="Close survey"><AppIcon name="X" /></button>
                </header>

                {success ? (
                    <div className="request-success">
                        <div className="request-success-icon"><AppIcon name="Check" size={34} /></div>
                        <span className="eyebrow">Feedback received</span>
                        <h4>Thank you for shaping the library.</h4>
                        <p>Your responses were recorded successfully and your local draft was cleared.</p>
                        <button type="button" className="button button-primary" onClick={close}>Return to library</button>
                    </div>
                ) : (
                    <>
                        <nav className="survey-progress" aria-label="Survey progress">
                            {STEP_TITLES.map((title, index) => (
                                <button type="button" key={title} className={`${index === step ? 'active' : ''} ${index < step ? 'complete' : ''}`} onClick={() => index < step && setStep(index)} disabled={index > step}>
                                    <span>{index < step ? <AppIcon name="Check" size={12} /> : index + 1}</span>
                                    <strong>{title}</strong>
                                </button>
                            ))}
                        </nav>

                        <div className="modal-body survey-step-body">
                            {step === 0 && (
                                <section className="survey-step animate-in">
                                    <div className="step-heading"><span>01</span><div><h3>How does the library fit your shift?</h3><p>Help us understand frequency and everyday usability.</p></div></div>
                                    <div className="survey-q">
                                        <label className="survey-q-label">How often do you use Screenshot Library?</label>
                                        <div className="survey-options">{USAGE_OPTIONS.map((option) => <button type="button" key={option} className={`survey-chip ${survey.usageFrequency === option ? 'active' : ''}`} onClick={() => setField('usageFrequency', option)}>{option}</button>)}</div>
                                    </div>
                                    <div className="survey-q"><label className="survey-q-label">Overall satisfaction</label><RatingScale label="Overall satisfaction" value={survey.satisfaction} onChange={(value) => setField('satisfaction', value)} /></div>
                                    <div className="survey-q"><label className="survey-q-label">How easy is it to find the right screenshot?</label><RatingScale label="Search ease" value={survey.searchEase} onChange={(value) => setField('searchEase', value)} /></div>
                                </section>
                            )}

                            {step === 1 && (
                                <section className="survey-step animate-in">
                                    <div className="step-heading"><span>02</span><div><h3>Where are the coverage gaps?</h3><p>Tell content owners what to prioritize next.</p></div></div>
                                    <div className="survey-q form-group">
                                        <label>Most under-covered topic</label>
                                        <select className="form-select" value={survey.underCoveredTopic} onChange={(event) => setField('underCoveredTopic', event.target.value)}><option value="">Choose topic</option>{topicOptions.map((topic) => <option key={topic}>{topic}</option>)}<option value="Other">Other</option></select>
                                        {survey.underCoveredTopic === 'Other' && <input className="form-input" maxLength={60} value={survey.customTopic} onChange={(event) => setField('customTopic', event.target.value)} placeholder="Topic name" />}
                                    </div>
                                    <div className="survey-q"><label className="survey-q-label">Languages that need more coverage</label><div className="survey-options">{LANGUAGE_OPTIONS.map(([code, label]) => <button type="button" key={code} className={`survey-chip ${survey.languagesNeeded.includes(code) ? 'active' : ''}`} onClick={() => toggleLanguage(code)}>{label} <small>{code}</small></button>)}</div></div>
                                    <div className="survey-q"><label className="survey-q-label">Preferred screenshot platform</label><div className="seg-control wide-segments">{PLATFORM_OPTIONS.map((option) => <button type="button" key={option} className={`seg-btn ${survey.platformPreference === option ? 'active' : ''}`} onClick={() => setField('platformPreference', option)}>{option}</button>)}</div></div>
                                    <div className="survey-q"><label className="survey-q-label">Request Screenshot experience</label><div className="survey-options survey-options-stack">{REQUEST_OPTIONS.map(([value, label]) => <button type="button" key={value} className={`survey-chip ${survey.requestExperience === value ? 'active' : ''}`} onClick={() => setField('requestExperience', value)}>{label}</button>)}</div></div>
                                </section>
                            )}

                            {step === 2 && (
                                <section className="survey-step animate-in">
                                    <div className="step-heading"><span>03</span><div><h3>What would make it meaningfully better?</h3><p>Concrete examples are the most useful input.</p></div></div>
                                    <div className="survey-q form-group"><label>Your number-one feature idea <span className="char-count">{survey.topFeature.length}/300</span></label><textarea className="form-textarea short" maxLength={300} value={survey.topFeature} onChange={(event) => setField('topFeature', event.target.value)} placeholder="The single improvement that would save you the most time" /></div>
                                    <div className="survey-q form-group"><label>Biggest frustration today <span className="char-count">{survey.biggestFrustration.length}/300</span></label><textarea className="form-textarea short" maxLength={300} value={survey.biggestFrustration} onChange={(event) => setField('biggestFrustration', event.target.value)} placeholder="A search, content, or workflow problem you repeatedly hit" /></div>
                                    <div className="survey-q form-group"><label>Anything else <span className="char-count">{survey.otherFeedback.length}/500</span></label><textarea className="form-textarea short" maxLength={500} value={survey.otherFeedback} onChange={(event) => setField('otherFeedback', event.target.value)} placeholder="Optional additional feedback" /></div>
                                </section>
                            )}

                            {step === 3 && (
                                <section className="survey-step animate-in">
                                    <div className="step-heading"><span>04</span><div><h3>Review before sending</h3><p>Confirm that this summary reflects your experience.</p></div></div>
                                    <dl className="survey-review">
                                        <div><dt>Usage</dt><dd>{survey.usageFrequency}</dd></div>
                                        <div><dt>Ratings</dt><dd>Satisfaction {survey.satisfaction}/5 · Search {survey.searchEase}/5</dd></div>
                                        <div><dt>Coverage</dt><dd>{resolvedTopic} · {survey.languagesNeeded.join(', ')}</dd></div>
                                        <div><dt>Platform</dt><dd>{survey.platformPreference}</dd></div>
                                        <div><dt>Top idea</dt><dd>{survey.topFeature}</dd></div>
                                        <div><dt>Friction</dt><dd>{survey.biggestFrustration}</dd></div>
                                    </dl>
                                </section>
                            )}

                            {error && <div className="request-error"><AppIcon name="Activity" size={16} /><span>{error}</span></div>}
                        </div>

                        <footer className="modal-footer survey-footer">
                            <span className="footer-hint">Step {step + 1} of 4</span>
                            <div className="footer-actions">
                                {step > 0 && <button type="button" className="button button-quiet" onClick={() => { setError(''); setStep((current) => current - 1); }} disabled={submitting}>Back</button>}
                                {step < 3
                                    ? <button type="button" className="button button-primary" onClick={next}>Continue <AppIcon name="ArrowRight" size={14} /></button>
                                    : <button type="button" className="button button-primary" onClick={submit} disabled={submitting}><AppIcon name="ClipboardList" size={14} /> {submitting ? 'Submitting…' : 'Submit feedback'}</button>}
                            </div>
                        </footer>
                    </>
                )}

                {confirmClose && (
                    <div className="discard-banner" role="alertdialog" aria-label="Discard survey draft">
                        <div><strong>Leave the survey?</strong><span>Your draft is saved on this device.</span></div>
                        <div><button type="button" className="button button-quiet" onClick={() => setConfirmClose(false)}>Keep editing</button><button type="button" className="button button-danger" onClick={close}>Leave</button></div>
                    </div>
                )}
            </section>
        </div>
    );
}
