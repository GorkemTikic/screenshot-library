import React, { useEffect, useState } from 'react';
import { contentApi } from '../../services/contentApi';
import { copyPlainText } from '../../utils/clipboard';
import { AppIcon } from '../AppIcon';

export function AccessManagement() {
    const [contributors, setContributors] = useState([]);
    const [displayName, setDisplayName] = useState('');
    const [role, setRole] = useState('contributor');
    const [issued, setIssued] = useState(null);
    const [status, setStatus] = useState('Loading contributors…');

    const load = async () => {
        setStatus('Loading contributors…');
        try { const result = await contentApi.contributors(); setContributors(result.contributors); setStatus(''); }
        catch (error) { setStatus(error.message); }
    };
    useEffect(() => {
        let alive = true;
        contentApi.contributors().then((result) => { if (alive) { setContributors(result.contributors); setStatus(''); } }).catch((error) => { if (alive) setStatus(error.message); });
        return () => { alive = false; };
    }, []);

    const create = async (event) => {
        event.preventDefault(); setStatus('Creating private access…');
        try { const result = await contentApi.createContributor(displayName, role); setIssued(result); setDisplayName(''); await load(); }
        catch (error) { setStatus(error.message); }
    };
    const toggle = async (contributor) => {
        setStatus(`Updating ${contributor.displayName}…`);
        try { await contentApi.updateContributor(contributor.id, { status: contributor.status === 'active' ? 'disabled' : 'active' }); await load(); }
        catch (error) { setStatus(error.message); }
    };
    const rotate = async (contributor) => {
        if (!window.confirm(`Rotate ${contributor.displayName}’s code? Their existing sessions will immediately close.`)) return;
        setStatus('Rotating code…');
        try { const result = await contentApi.rotateContributorCode(contributor.id); setIssued(result); await load(); }
        catch (error) { setStatus(error.message); }
    };

    return <div className="access-workspace">
        <section className="access-create-panel"><span className="eyebrow">Owner controls</span><h2>Invite a contributor</h2><p>Every person receives a separate code. Their edits are attributed by name and their access can be closed independently.</p><form onSubmit={create}><label className="form-group"><span>Display name</span><input className="form-input" required minLength={2} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="e.g. CS Ada" /></label><label className="form-group"><span>Permission</span><select className="form-select" value={role} onChange={(event) => setRole(event.target.value)}><option value="contributor">Contributor · create and update</option><option value="owner">Owner · full access</option></select></label><button className="button button-primary full-width" type="submit"><AppIcon name="Plus" size={15} /> Create personal code</button></form><div className="access-policy"><AppIcon name="ShieldCheck" size={18} /><span><strong>Codes are not recoverable.</strong><small>Only the hash is stored. Rotate a code if it is lost or exposed.</small></span></div></section>
        <section className="access-list-panel"><div className="panel-heading"><div><span className="eyebrow">Active team</span><h2>{contributors.length} identities</h2></div><button type="button" className="icon-button" onClick={load}><AppIcon name="RefreshCw" size={16} /></button></div>{status && <p className="inline-status">{status}</p>}<div className="contributor-list">{contributors.map((contributor) => <article key={contributor.id} className={contributor.status === 'disabled' ? 'contributor-row is-disabled' : 'contributor-row'}><div className="contributor-avatar">{contributor.displayName.replace(/^CS\s+/i, '').split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}</div><div className="contributor-info"><strong>{contributor.displayName}</strong><span>{contributor.role} · {contributor.status}</span><small>{contributor.lastLoginAt ? `Last access ${new Date(contributor.lastLoginAt).toLocaleString()}` : 'Has not signed in yet'}</small></div><div className="contributor-actions"><button type="button" className="button button-quiet button-small" onClick={() => rotate(contributor)}><AppIcon name="RotateCcw" size={13} /> New code</button><button type="button" className={`button button-small ${contributor.status === 'active' ? 'button-danger' : 'button-quiet'}`} onClick={() => toggle(contributor)}>{contributor.status === 'active' ? 'Disable' : 'Enable'}</button></div></article>)}</div></section>
        {issued && <div className="modal-overlay code-overlay"><section className="modal-content issued-code-dialog" role="dialog" aria-modal="true"><div className="auth-icon-wrapper"><AppIcon name="LockKeyhole" /></div><span className="eyebrow">Shown once</span><h2>Access for {issued.contributor.displayName}</h2><p>Send this code through a private channel. It cannot be retrieved after this window closes.</p><code className="issued-code">{issued.accessCode}</code><div className="issued-actions"><button type="button" className="button button-quiet" onClick={() => setIssued(null)}>I’ve saved it</button><button type="button" className="button button-primary" onClick={async () => { await copyPlainText(issued.accessCode); setStatus('Access code copied.'); }}><AppIcon name="Copy" size={15} /> Copy code</button></div></section></div>}
    </div>;
}
