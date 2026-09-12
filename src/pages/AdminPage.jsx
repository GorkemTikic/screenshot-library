import React, { useCallback, useEffect, useState } from 'react';
import { AccessGate } from '../components/AccessGate';
import { AppIcon } from '../components/AppIcon';
import { ContentList } from '../components/admin/ContentList';
import { ContentEditor } from '../components/admin/ContentEditor';
import { AccessManagement } from '../components/admin/AccessManagement';
import { AuditLog } from '../components/admin/AuditLog';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { contentApi } from '../services/contentApi';

const TABS = [
    { id: 'content', label: 'Content', icon: 'FileImage' },
    { id: 'access', label: 'Access', icon: 'UsersRound', ownerOnly: true },
    { id: 'audit', label: 'Audit trail', icon: 'Activity', ownerOnly: true },
];

function ContentStudio() {
    const auth = useAuth();
    const { items, replaceItems, upsertCanonicalItem } = useData();
    const [activeTab, setActiveTab] = useState('content');
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState('');

    const refresh = useCallback(async () => {
        setLoading(true); setNotice('');
        try { const result = await contentApi.content(); replaceItems(result.items); }
        catch (error) { setNotice(`Could not fetch the live repository: ${error.message}`); }
        finally { setLoading(false); }
    }, [replaceItems]);
    useEffect(() => { refresh(); }, [refresh]);

    const openEditor = (item = null) => { setEditingItem(item); setEditorOpen(true); };
    const published = (record) => { upsertCanonicalItem(record); setNotice(`“${record.title}” published by ${auth.principal.displayName}.`); };

    return <div className="studio-page animate-in">
        <header className="studio-page-header"><div><span className="eyebrow"><AppIcon name="Sparkles" size={13} /> FD editorial operations</span><h1>Content Studio</h1><p>Add guides, replace outdated screenshots, and edit EN/TR copy without touching the repository.</p></div><div className="studio-identity"><span className="status-dot" /><div><strong>{auth.principal.displayName}</strong><small>{auth.principal.role} session</small></div></div></header>
        <nav className="studio-tabs" aria-label="Content Studio sections">{TABS.filter((tab) => !tab.ownerOnly || auth.isOwner).map((tab) => <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} className={activeTab === tab.id ? 'active' : ''}><AppIcon name={tab.icon} size={15} />{tab.label}</button>)}</nav>
        {notice && <div className="studio-notice"><AppIcon name="CheckCircle2" size={15} />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><AppIcon name="X" size={13} /></button></div>}
        {activeTab === 'content' && <ContentList items={items} onEdit={openEditor} onCreate={() => openEditor(null)} onRefresh={refresh} loading={loading} canRecover={auth.isOwner} />}
        {activeTab === 'access' && auth.isOwner && <AccessManagement />}
        {activeTab === 'audit' && auth.isOwner && <AuditLog />}
        {editorOpen && <ContentEditor item={editingItem} onClose={() => setEditorOpen(false)} onPublished={published} />}
    </div>;
}

export function AdminPage() {
    return <AccessGate title="Content Studio"><ContentStudio /></AccessGate>;
}
