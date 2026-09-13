import React, { useEffect, useRef, useState } from 'react';
import { TOPIC_META, normalizePlatform, ownerColorStyle, ownerInitials } from '../domain/catalog';
import { screenshotEvent } from '../domain/analyticsEvents';
import { logEvent } from '../services/analytics';
import { copyPlainText } from '../utils/clipboard';
import { resolveImageUrl } from '../utils/imageUtils';
import { AppIcon } from './AppIcon';
import { ScreenshotCopyButton } from './ScreenshotCopyButton';

export function Lightbox({ item, position, total, onClose, onNavigate }) {
    const closeRef = useRef(null);
    const [contentLang, setContentLang] = useState('en');
    const [copied, setCopied] = useState(false);
    const hasTr = Boolean(item.text_tr?.trim());
    const currentText = contentLang === 'tr' && hasTr ? item.text_tr : item.text;
    const topic = TOPIC_META[item.topic] || TOPIC_META.General;
    const avatarStyle = ownerColorStyle(item.owner);

    useEffect(() => {
        const previouslyFocused = document.activeElement;
        closeRef.current?.focus();
        const handleKey = (event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowLeft' && total > 1) onNavigate(-1);
            if (event.key === 'ArrowRight' && total > 1) onNavigate(1);
            if (event.key === 'Tab') {
                const controls = event.currentTarget?.querySelectorAll?.('button, a, [tabindex="0"]');
                if (!controls?.length) return;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('keydown', handleKey);
            previouslyFocused?.focus?.({ preventScroll: true });
        };
    }, [onClose, onNavigate, total]);

    const handleCopy = async () => {
        const successful = await copyPlainText(currentText || '');
        if (successful) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
        }
        logEvent('copy_text', screenshotEvent(item, {
            responseLanguage: contentLang,
            source: 'inspector',
            method: successful ? 'clipboard' : 'failed',
            success: String(successful),
        }));
    };

    return (
        <div className="lightbox-overlay inspector-overlay" role="dialog" aria-modal="true" aria-labelledby="inspector-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <div className="inspector-shell">
                <div className="inspector-media">
                    <img src={resolveImageUrl(item.image)} alt={item.title} />
                    {total > 1 && (
                        <>
                            <button type="button" className="inspector-nav previous" onClick={() => onNavigate(-1)} aria-label="Previous screenshot"><AppIcon name="ArrowLeft" /></button>
                            <button type="button" className="inspector-nav next" onClick={() => onNavigate(1)} aria-label="Next screenshot"><AppIcon name="ArrowRight" /></button>
                        </>
                    )}
                </div>
                <aside className="inspector-panel">
                    <div className="inspector-head">
                        <span className="inspector-position">{position + 1} / {total}</span>
                        <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close inspector"><AppIcon name="X" /></button>
                    </div>
                    <div className="inspector-meta">
                        <span className="tag"><AppIcon name={topic.icon} size={12} /> {item.topic || 'General'}</span>
                        <span className="metadata-pair"><AppIcon name={normalizePlatform(item.platform) === 'web' ? 'Monitor' : 'Smartphone'} size={12} /> {item.language}</span>
                    </div>
                    <h2 id="inspector-title">{item.title}</h2>
                    <div className="owner-row inspector-owner">
                        <span className="owner-avatar" style={avatarStyle}>{ownerInitials(item.owner)}</span>
                        <span className="owner-copy"><small>Prepared by</small><strong>{item.owner}</strong></span>
                    </div>
                    {hasTr && (
                        <div className="inspector-language">
                            <span>Response language</span>
                            <div className="lang-switch-container">
                                {['en', 'tr'].map((language) => (
                                    <button type="button" key={language} className={`lang-switch-btn ${contentLang === language ? 'active' : ''}`} onClick={() => { setContentLang(language); logEvent('switch_lang', screenshotEvent(item, { responseLanguage: language, source: 'inspector' })); }}>{language.toUpperCase()}</button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="inspector-response">{currentText || 'No response text is available for this screenshot.'}</div>
                    <div className="inspector-actions">
                        <ScreenshotCopyButton item={item} source="inspector" />
                        <button type="button" className={`button button-quiet inspector-response-copy ${copied ? 'is-success' : ''}`} onClick={handleCopy}><AppIcon name={copied ? 'Check' : 'Copy'} size={15} /> {copied ? 'Copied' : 'Copy response'}</button>
                        <a className="button button-quiet" href={resolveImageUrl(item.image)} target="_blank" rel="noreferrer"><AppIcon name="ExternalLink" size={15} /> Open image</a>
                    </div>
                </aside>
            </div>
        </div>
    );
}
