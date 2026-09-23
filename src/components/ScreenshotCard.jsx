import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { normalizePlatform, ownerColorStyle, ownerInitials } from '../domain/catalog';
import { topicMeta } from '../domain/topics';
import { screenshotEvent } from '../domain/analyticsEvents';
import { logEvent } from '../services/analytics';
import { copyPlainText } from '../utils/clipboard';
import { resolveImageUrl } from '../utils/imageUtils';
import { formatDate, getLangCode } from '../utils/langUtils';
import { AppIcon } from './AppIcon';
import { ScreenshotCopyButton } from './ScreenshotCopyButton';

function Highlight({ children, query }) {
    const text = String(children || '');
    const index = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
    if (index < 0) return text;
    return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

export function ScreenshotCard({ item, onInspect, search = '' }) {
    const { isFavorite, toggleFavorite } = useData();
    const [copied, setCopied] = useState(false);
    const [contentLang, setContentLang] = useState('en');
    const hasTr = Boolean(item.text_tr?.trim());
    const currentText = contentLang === 'tr' && hasTr ? item.text_tr : item.text;
    const topic = topicMeta(item.topic);
    const avatarStyle = ownerColorStyle(item.owner);

    const handleCopy = async (event) => {
        event.stopPropagation();
        const successful = await copyPlainText(currentText || '');
        if (successful) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
        }
        logEvent('copy_text', screenshotEvent(item, {
            responseLanguage: contentLang,
            source: 'card',
            method: successful ? 'clipboard' : 'failed',
            success: String(successful),
        }));
    };

    const inspect = () => {
        logEvent('view_image', screenshotEvent(item, { source: 'card' }));
        onInspect();
    };

    return (
        <article className="card">
            <div className="card-image-wrapper" onClick={inspect} onContextMenu={() => logEvent('right_click_image', screenshotEvent(item, { source: 'card' }))}>
                <img
                    src={resolveImageUrl(item.image)}
                    alt={item.title}
                    className="card-image"
                    loading="lazy"
                    onError={(event) => {
                        event.currentTarget.hidden = true;
                        event.currentTarget.parentElement.classList.add('image-error');
                    }}
                />
                <div className="image-placeholder"><AppIcon name="FileImage" size={26} /><span>Preview unavailable</span></div>
                <div className="card-overlay">
                    <button
                        type="button"
                        className={`fav-btn ${isFavorite(item.title) ? 'active' : ''}`}
                        aria-label={isFavorite(item.title) ? 'Remove from favorites' : 'Add to favorites'}
                        onClick={(event) => {
                            event.stopPropagation();
                            const adding = !isFavorite(item.title);
                            toggleFavorite(item.title);
                            logEvent(adding ? 'favorite_add' : 'favorite_remove', screenshotEvent(item, { source: 'card' }));
                        }}
                    >
                        <AppIcon name="Heart" size={15} fill={isFavorite(item.title) ? 'currentColor' : 'none'} />
                    </button>
                </div>
            </div>

            <div className="card-content">
                <div className="card-meta">
                    <span className="tag"><AppIcon name={topic.icon} size={12} /> {item.topic || 'General'}</span>
                    <span className="metadata-pair"><AppIcon name={normalizePlatform(item.platform) === 'web' ? 'Monitor' : 'Smartphone'} size={12} /> {item.language}</span>
                </div>

                <h2 className="card-title" title={item.title}><Highlight query={search}>{item.title}</Highlight></h2>

                <div className="owner-row">
                    <span className="owner-avatar" style={avatarStyle}>{ownerInitials(item.owner)}</span>
                    <span className="owner-copy"><small>Prepared by</small><strong>{item.owner || 'Unassigned'}</strong></span>
                    <span className="card-updated"><AppIcon name="Clock3" size={11} /> {item.updatedAt || formatDate(item.id, item.language)}</span>
                </div>

                {hasTr && (
                    <div className="card-action-row">
                        <div className="lang-switch-container" aria-label="Response language">
                            {['en', 'tr'].map((language) => (
                                <button
                                    type="button"
                                    key={language}
                                    className={`lang-switch-btn ${contentLang === language ? 'active' : ''}`}
                                    aria-pressed={contentLang === language}
                                    onClick={() => {
                                        setContentLang(language);
                                        logEvent('switch_lang', screenshotEvent(item, { responseLanguage: language, source: 'card' }));
                                    }}
                                >
                                    {language.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="card-actions">
                    <ScreenshotCopyButton item={item} source="card" />
                    <button type="button" onClick={handleCopy} className={`btn btn-copy ${copied ? 'copied' : ''}`}>
                        <AppIcon name={copied ? 'Check' : 'Copy'} size={15} />
                        {copied ? 'Copied' : `Copy ${contentLang === 'tr' ? 'TR' : getLangCode(item.language)}`}
                    </button>
                    <button type="button" className="btn-icon" onClick={inspect} aria-label="Inspect screenshot"><AppIcon name="Eye" size={17} /></button>
                </div>
            </div>
        </article>
    );
}
