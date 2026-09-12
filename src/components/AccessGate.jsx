import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AppIcon } from './AppIcon';

export function AccessGate({ children, ownerOnly = false, title = 'Content Studio' }) {
    const auth = useAuth();
    const [code, setCode] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!auth.apiAvailable) {
        return <div className="auth-container"><div className="auth-card"><div className="auth-icon-wrapper"><AppIcon name="PanelTop" size={22} /></div><h1 className="auth-title">{title} is ready to connect</h1><p className="auth-subtitle">Set <code>VITE_CONTENT_API_URL</code> to the independent Screenshot Library Worker URL.</p><div className="setup-note">Public Library, Request, and Survey remain available without the publishing API.</div></div></div>;
    }
    if (auth.status === 'loading') return <div className="auth-container"><div className="auth-card auth-loading"><span className="spinner" /><p>Checking secure access…</p></div></div>;
    if (auth.status !== 'authenticated') {
        return (
            <div className="auth-container animate-in"><form className="auth-card access-card" onSubmit={async (event) => {
                event.preventDefault(); setSubmitting(true);
                try { await auth.login(code.trim()); } catch { /* rendered from auth state */ }
                finally { setSubmitting(false); }
            }}>
                <div className="auth-icon-wrapper"><AppIcon name="LockKeyhole" size={22} /></div><span className="eyebrow">Personal contributor access</span><h1 className="auth-title">Open {title}</h1><p className="auth-subtitle">Use the private code issued to you by the Library owner.</p>
                <label className="form-group access-code-field"><span>Access code</span><input type="password" className="form-input" autoComplete="current-password" value={code} onChange={(event) => setCode(event.target.value)} placeholder="fdsl_…" /></label>
                {auth.error && <div className="request-error"><AppIcon name="Activity" size={15} /> {auth.error}</div>}
                <button type="submit" className="button button-primary full-width" disabled={submitting || !code.trim()}>{submitting ? 'Checking…' : 'Continue securely'}</button><p className="access-privacy">Your code is exchanged for a short-lived session and is never stored in the Library.</p>
            </form></div>
        );
    }
    if (ownerOnly && !auth.isOwner) return <div className="auth-container"><div className="auth-card"><div className="auth-icon-wrapper"><AppIcon name="ShieldCheck" size={22} /></div><h1 className="auth-title">Owner access required</h1><p className="auth-subtitle">Signed in as {auth.principal.displayName}. This insight area is limited to Library owners.</p></div></div>;
    return children;
}
