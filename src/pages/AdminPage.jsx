import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { Plus, Search, Trash2, Edit2, X, Save, Settings as SettingsIcon, Github } from 'lucide-react';
import { githubService } from '../services/github';


export function AdminPage() {
    console.log("AdminPage: Rendering started");
    const contextData = useData();
    console.log("AdminPage: Context Data:", contextData);

    const { items, addItem, updateItem, deleteItem, allTopics } = contextData || {}; // Safe destructuring for debug
    console.log("AdminPage: Items:", items?.length, "Topics:", allTopics);

    const [searchTerm, setSearchTerm] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');

    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Form State

    // ... (auth check)

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        let finalData = { ...formData };
        // Handle New Topic
        if (finalData.topic === 'NEW') {
            if (!finalData.newTopicName) return alert("Please enter a topic name");
            finalData.topic = finalData.newTopicName;
            delete finalData.newTopicName;
        }

        let newItems;
        if (editingId) {
            updateItem(editingId, finalData); // Fixed: update -> updateItem
            newItems = items.map(i => i.id === editingId ? { ...i, ...finalData } : i);
        } else {
            addItem({ ...finalData, id: Date.now() }); // Fixed: add -> addItem
            newItems = [...items, { ...finalData, id: Date.now() }];
        }

        // Auto-sync to GitHub
        if (githubService.isConfigured()) {
            const confirmSync = window.confirm("Saved locally. Do you want to push updates to GitHub (data.json)?");
            if (confirmSync) {
                try {
                    setSyncStatus('syncing');
                    await githubService.updateDataJson(newItems);
                    setSyncStatus('success');
                    alert("Successfully synced to GitHub!");
                } catch (err) {
                    setSyncStatus('error');
                    alert("GitHub Sync Failed: " + err.message);
                }
            }
        }

        setIsModalOpen(false);
        resetForm();
    };

    // ...

    const handleDelete = (id) => {
        if (window.confirm('Delete this item?')) {
            deleteItem(id); // Fixed: remove -> deleteItem
            const newItems = items.filter(i => i.id !== id);
            syncToGithub(newItems);
        }
    };

    // Filtered Items
    const safeItems = items || [];
    const filteredItems = safeItems.filter(item =>
        (item.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.text || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="admin-container animate-in">
            <div className="admin-header">
                <div>
                    <h2 className="page-title">Content Management</h2>
                    <p className="text-muted">Manage your screenshots knowledge base</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={() => setIsSettingsOpen(true)}>
                        <Github size={18} className="mr-2" /> GitHub Settings
                    </button>
                    <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
                        <Plus size={18} className="mr-2" /> Add New
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="search-bar-container" style={{ maxWidth: '100%', marginBottom: '32px' }}>
                <Search className="search-icon" size={20} />
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search content..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Content Grid */}
            <div className="admin-grid">
                {filteredItems.map(item => (
                    <div key={item.id} className="admin-card">
                        <div className="admin-card-img">
                            <img src={item.image} alt={item.title} loading="lazy" />
                            <div className="admin-card-overlay">
                                <span className={`tag tag-${(item.topic || 'general').toLowerCase()}`}>{item.topic}</span>
                            </div>
                        </div>
                        <div className="admin-card-body">
                            <h3 className="admin-card-title">{item.title}</h3>
                            <div className="admin-card-meta">
                                <span className="text-muted">{item.language}</span>
                                <span className="text-muted text-xs">ID: {item.id}</span>
                            </div>
                            <div className="admin-card-actions">
                                <button className="btn-icon" onClick={() => handleEdit(item)} title="Edit">
                                    <Edit2 size={18} />
                                </button>
                                <button className="btn-icon danger" onClick={() => handleDelete(item.id)} title="Delete">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3>GitHub Configuration</h3>
                            <button className="close-btn" onClick={() => setIsSettingsOpen(false)}><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>GitHub Token (Repo Scope)</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={ghConfig.token}
                                    onChange={e => setGhConfig({ ...ghConfig, token: e.target.value })}
                                    placeholder="ghp_..."
                                />
                                <small className="text-muted">Stored securely in your browser. Owner/Repo are hardcoded.</small>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setIsSettingsOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveSettings}>Save Configuration</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>{editingId ? 'Edit Screenshot' : 'Add New Screenshot'}</h3>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleFormSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Title</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        required
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Image Source</label>

                                    {/* GitHub Upload Button */}
                                    {githubService.isConfigured() && (
                                        <div style={{ marginBottom: '10px' }}>
                                            <label className={`btn btn-secondary full-width ${uploading ? 'disabled' : ''}`} style={{ cursor: 'pointer', display: 'block', textAlign: 'center' }}>
                                                {uploading ? 'Uploading...' : '☁️ Upload Image to GitHub'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={handleFileUpload}
                                                    disabled={uploading}
                                                />
                                            </label>
                                        </div>
                                    )}

                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="https://..."
                                        required
                                        value={formData.image}
                                        onChange={e => setFormData({ ...formData, image: e.target.value })}
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Topic</label>
                                        <select
                                            className="form-select"
                                            value={formData.topic}
                                            onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                        >
                                            <option value="">Select Topic...</option>
                                            {/* Dynamic Topics */}
                                            {(allTopics || []).map(topic => (
                                                <option key={topic} value={topic}>{topic}</option>
                                            ))}
                                            <option value="NEW">+ Create New Topic</option>
                                        </select>
                                        {formData.topic === 'NEW' && (
                                            <input
                                                type="text"
                                                className="form-input mt-2"
                                                placeholder="Enter new topic name"
                                                onChange={(e) => setFormData(prev => ({ ...prev, newTopicName: e.target.value }))}
                                            />
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>Language</label>
                                        <select
                                            className="form-select"
                                            value={formData.language}
                                            onChange={e => setFormData({ ...formData, language: e.target.value })}
                                        >
                                            <option value="Multi">Multi-Language</option>
                                            <option value="EN">English Only</option>
                                            <option value="TR">Turkish Only</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>English Text (Content)</label>
                                    <textarea
                                        className="form-textarea"
                                        required
                                        value={formData.text}
                                        onChange={e => setFormData({ ...formData, text: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Turkish Text (Optional)</label>
                                    <textarea
                                        className="form-textarea short"
                                        value={formData.text_tr || ''}
                                        onChange={e => setFormData({ ...formData, text_tr: e.target.value })}
                                        placeholder="Türkçe çevirisi varsa buraya ekleyin..."
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={syncStatus === 'syncing'}>
                                    {syncStatus === 'syncing' ? 'Syncing...' : <><Save size={18} className="mr-2" /> Save & Sync</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
