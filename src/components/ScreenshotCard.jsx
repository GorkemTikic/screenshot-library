import React, { useState } from 'react';
import { Copy, Eye, Heart, Check, MessageSquare, Send } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { logEvent } from '../services/analytics';

import { resolveImageUrl } from '../utils/imageUtils';
import { getLangCode } from '../utils/langUtils';

export function ScreenshotCard({ item, onClickImage }) {
    const { isFavorite, toggleFavorite, addFeedback, syncFeedbacks, feedbacks } = useData();
    const [copied, setCopied] = useState(false);
    const [showText, setShowText] = useState(false);
    const [contentLang, setContentLang] = useState('en'); // 'en' or 'tr'
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const hasTr = item.text_tr && item.text_tr.trim().length > 0;
    const currentText = (contentLang === 'tr' && hasTr) ? item.text_tr : item.text;

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(currentText);
        setCopied(true);
        // Log event
        logEvent('copy_text', {
            title: item.title,
            topic: item.topic,
            language: contentLang
        });
        setTimeout(() => setCopied(false), 2000);
    };

    const handleToggleFavorite = (e) => {
        e.stopPropagation();
        toggleFavorite(item.title);
        // Log if adding favorite
        if (!isFavorite(item.title)) {
            logEvent('favorite_add', { title: item.title, topic: item.topic });
        }
    };

    const handlePreviewToggle = (e) => {
        e.stopPropagation();
        const newState = !showText;
        setShowText(newState);
        if (newState) {
            logEvent('preview_text', { title: item.title, topic: item.topic });
        }
    };

    const handleLangSwitch = (e, lang) => {
        e.stopPropagation();
        setContentLang(lang);
        logEvent('switch_lang', { title: item.title, topic: item.topic, language: lang });
    };

    const handleImageClick = () => {
        logEvent('view_image', { title: item.title, topic: item.topic });
        onClickImage(item);
    };

    const handleFeedbackSubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!feedbackMessage.trim()) return;

        setIsSubmitting(true);
        const newFb = addFeedback(item.id, feedbackMessage);

        logEvent('send_feedback', { title: item.title, topic: item.topic });

        // Auto-sync: Send BOTH the new one and the existing ones to avoid stale state
        syncFeedbacks([newFb, ...feedbacks]).catch(err => console.error("Auto-sync failed:", err));

        // Small delay for UX
        setTimeout(() => {
            setFeedbackMessage('');
            setIsFeedbackOpen(false);
            setIsSubmitting(false);
            alert('Feedback sent! Admin will review it.');
        }, 600);
    };

    const getTopicClass = (t) => {
        const clean = (t || 'General').replace(/\s+/g, '-').toLowerCase();
        return `tag tag-${clean}`;
    };

    return (
        <div className="card">
            {/* Image Area */}
            <div className="card-image-wrapper" onClick={handleImageClick}>
                <img
                    src={resolveImageUrl(item.image)}
                    alt={item.title}
                    className="card-image"
                    onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentNode.classList.add('image-error');
                        console.error('Image failed to load:', resolveImageUrl(item.image));
                    }}
                />
                <div className="image-placeholder">
                    <span>Image N/A</span>
                    <span style={{ fontSize: '0.6rem', padding: '0 10px', textAlign: 'center', marginTop: '5px' }}>
                        {resolveImageUrl(item.image)}
                    </span>
                </div>
                <div className="card-overlay">
                    <button
                        onClick={handleToggleFavorite}
                        className={`fav-btn ${isFavorite(item.title) ? 'active' : ''}`}
                        title={isFavorite(item.title) ? "Remove from Favorites" : "Add to Favorites"}
                    >
                        <Heart size={16} fill={isFavorite(item.title) ? "currentColor" : "none"} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="card-content">
                <div className="card-meta">
                    <span className={getTopicClass(item.topic)}>
                        {item.topic || 'General'}
                    </span>
                    <span className="lang-badge">
                        {item.language}
                    </span>
                </div>

                <h3 className="card-title" title={item.title}>
                    {item.title}
                </h3>

                {/* Language Toggle */}
                {hasTr && (
                    <div className="lang-switch-container">
                        <button
                            className={`lang-switch-btn ${contentLang === 'en' ? 'active' : ''}`}
                            onClick={(e) => handleLangSwitch(e, 'en')}
                        >
                            EN
                        </button>
                        <span className="lang-divider">|</span>
                        <button
                            className={`lang-switch-btn ${contentLang === 'tr' ? 'active' : ''}`}
                            onClick={(e) => handleLangSwitch(e, 'tr')}
                        >
                            TR
                        </button>
                    </div>
                )}

                {/* Actions */}
                <div className="card-actions">
                    <button
                        onClick={handleCopy}
                        className={`btn btn-copy ${copied ? 'copied' : ''}`}
                        title="Copy Content"
                    >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? 'Copied' : `Copy (${contentLang === 'en' ? getLangCode(item.language) : 'TR'})`}
                    </button>

                    <button
                        onClick={handlePreviewToggle}
                        className="btn btn-icon"
                        title="Preview Text"
                    >
                        {showText ? <Eye className="text-primary" size={20} /> : <Eye size={20} />}
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); setIsFeedbackOpen(!isFeedbackOpen); }}
                        className={`btn btn-icon ${isFeedbackOpen ? 'active' : ''}`}
                        title="Report Outdated / Give Feedback"
                    >
                        <MessageSquare size={18} className={isFeedbackOpen ? 'text-primary' : ''} />
                    </button>
                </div>

                {/* Feedback Popover */}
                {isFeedbackOpen && (
                    <div className="feedback-popover animate-in" onClick={e => e.stopPropagation()}>
                        <form onSubmit={handleFeedbackSubmit} className="feedback-form">
                            <textarea
                                className="feedback-textarea"
                                placeholder="What's outdated or wrong?"
                                value={feedbackMessage}
                                onChange={e => setFeedbackMessage(e.target.value)}
                                autoFocus
                                required
                            />
                            <div className="feedback-actions">
                                <button
                                    type="button"
                                    className="btn btn-xs"
                                    onClick={() => setIsFeedbackOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-xs btn-primary"
                                    disabled={isSubmitting || !feedbackMessage.trim()}
                                >
                                    {isSubmitting ? '...' : <><Send size={12} /> Send</>}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Text Preview */}
                {showText && (
                    <div className="text-preview">
                        {currentText}
                    </div>
                )}
            </div>
        </div>
    );
}
