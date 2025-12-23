import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { Plus, Search, Trash2, Edit2, X, Save, Settings as SettingsIcon, Github, Smartphone, Monitor, MessageSquare, CheckCircle } from 'lucide-react';
import { githubService } from '../services/github';

export function AdminPage() {
    const { items, addItem, updateItem, deleteItem, allTopics, allLanguages, feedbacks, resolveFeedback, syncData, syncFeedbacks } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');

    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedbackTab, setFeedbackTab] = useState('active'); // 'active' or 'history'

    // Form State
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        text: '',
        text_tr: '',
        image: '',
        topic: '',
        language: 'English',
        platform: 'mobile',
        newLanguageName: ''
    });

    // GitHub Settings State
    const [ghConfig, setGhConfig] = useState({ token: '' });
    const [uploading, setUploading] = useState(false);
    const [syncStatus, setSyncStatus] = useState(''); // 'idle', 'syncing', 'success', 'error'

    useEffect(() => {
        if (githubService.isConfigured()) {
            setGhConfig(githubService.getConfig());
        }
    }, []);

    // Group feedbacks by item for the UI
    const groupedFeedbacks = useMemo(() => {
        if (!feedbacks) return [];
        const targetStatus = feedbackTab === 'active' ? 'active' : 'resolved';
        const currentList = feedbacks.filter(fb => fb.status === targetStatus);
        const groups = {};

        currentList.forEach(fb => {
            if (!groups[fb.itemId]) {
                const item = (items || []).find(i => i.id === fb.itemId);
                groups[fb.itemId] = {
                    item: item || { title: `Unknown Item (${fb.itemId})`, image: '', topic: 'N/A' },
                    feedbacks: []
                };
            }
            groups[fb.itemId].feedbacks.push(fb);
        });

        return Object.values(groups);
    }, [feedbacks, feedbackTab, items]);

    const feedbackCount = (feedbacks || []).filter(fb => fb.status === 'active').length;

    // Filtered Items
    const safeItems = items || [];
    const filteredItems = safeItems.filter(item =>
        (item.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.text || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Auth Check
    if (!isAuthenticated) {
        return (
            <div className="auth-container animate-in">
                <div className="auth-card">
                    <div className="auth-icon-wrapper">
                        <SettingsIcon size={24} />
                    </div>
                    <h2 className="auth-title">Admin Panel</h2>
                    <p className="auth-subtitle">Restricted Access</p>
                    <input
                        type="password"
                        className="form-input"
                        placeholder="Enter password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && password === 'admin123' && setIsAuthenticated(true)}
                        style={{ marginBottom: '16px' }}
                    />
                    <button
                        className="btn btn-primary full-width"
                        onClick={() => password === 'admin123' ? setIsAuthenticated(true) : alert('Wrong password!')}
                    >
                        Login
                    </button>
                </div>
            </div>
        );
    }

    const resetForm = () => {
        setFormData({ title: '', text: '', text_tr: '', image: '', topic: '', language: 'English', platform: 'mobile', newLanguageName: '' });
        setEditingId(null);
        setSyncStatus('');
    };

    const handleEdit = (item) => {
        setFormData(item);
        setEditingId(item.id);
        setIsModalOpen(true);
    };

    const handleDelete = async (itemId) => {
        if (window.confirm("Are you sure you want to delete this item?")) {
            deleteItem(itemId);
            const newItems = items.filter(i => i.id !== itemId);
            if (githubService.isConfigured()) {
                const confirmSync = window.confirm("Deleted locally. Sync change to GitHub?");
                if (confirmSync) {
                    try {
                        setSyncStatus('syncing');
                        await githubService.updateDataJson(newItems);
                        setSyncStatus('success');
                        alert("Successfully synced to GitHub!");
                    } catch (err) {
                        setSyncStatus('error');
                        alert("Sync failed: " + err.message);
                    }
                }
            }
        }
    };

    const handleSaveSettings = () => {
        const { token } = ghConfig;
        if (token) {
            githubService.saveConfig(token);
            setIsSettingsOpen(false);
            alert("GitHub Configuration Saved!");
        } else {
            alert("Please enter a token");
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!githubService.isConfigured()) {
            alert("Please configure GitHub settings first!");
            return;
        }

        try {
            setUploading(true);
            const imageUrl = await githubService.uploadImage(file);
            setFormData(prev => ({ ...prev, image: imageUrl }));
            setUploading(false);
        } catch (error) {
            console.error(error);
            alert("Upload failed: " + error.message);
            setUploading(false);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        let finalData = { ...formData };
        if (finalData.topic === 'NEW') {
            if (!finalData.newTopicName) return alert("Please enter a topic name");
            finalData.topic = finalData.newTopicName;
            delete finalData.newTopicName;
        }

        if (finalData.language === 'NEW') {
            if (!finalData.newLanguageName) return alert("Please enter a language name");
            finalData.language = finalData.newLanguageName;
            delete finalData.newLanguageName;
        }

        let newItems;
        if (editingId) {
            updateItem(editingId, finalData);
            newItems = items.map(i => i.id === editingId ? { ...i, ...finalData } : i);
        } else {
            const newItem = { ...finalData, id: Date.now() };
            addItem(newItem);
            newItems = [...items, newItem];
        }

        if (githubService.isConfigured()) {
            const confirmSync = window.confirm("Saved locally. Do you want to push updates to GitHub?");
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

    const handleResolveFeedback = async (feedbackId) => {
        if (!window.confirm("Mark this feedback as resolved and sync to GitHub?")) return;

        const updatedFeedbacks = resolveFeedback(feedbackId);

        try {
            await syncFeedbacks(updatedFeedbacks);
        } catch (err) {
            console.error("Resolution sync failed", err);
        }
    };

    return (
        <div className="admin-container animate-in">
            <div className="admin-header">
                <div>
                    <h2 className="page-title">Content Management</h2>
                    <p className="text-muted">Manage your screenshots knowledge base</p>
                </div>
                <div className="header-actions">
                    <button className={`btn btn-secondary ${feedbackCount > 0 ? 'pulse' : ''}`} onClick={() => setIsFeedbackModalOpen(true)}>
                        <MessageSquare size={18} className="mr-2" />
                        Feedbacks {feedbackCount > 0 && <span className="feedback-badge">{feedbackCount}</span>}
                    </button>
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
                                <div className="flex items-center gap-1 text-muted text-xs">
                                    {item.platform === 'web' ? <Monitor size={14} /> : <Smartphone size={14} />}
                                    <span>ID: {item.id}</span>
                                </div>
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
                                    <label>Platform</label>
                                    <div className="flex gap-4">
                                        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${formData.platform === 'mobile' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                                            <input
                                                type="radio"
                                                name="platform"
                                                value="mobile"
                                                checked={formData.platform === 'mobile'}
                                                onChange={e => setFormData({ ...formData, platform: e.target.value })}
                                                className="hidden"
                                            />
                                            <Smartphone size={18} />
                                            <span>Mobile App</span>
                                        </label>
                                        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${formData.platform === 'web' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                                            <input
                                                type="radio"
                                                name="platform"
                                                value="web"
                                                checked={formData.platform === 'web'}
                                                onChange={e => setFormData({ ...formData, platform: e.target.value })}
                                                className="hidden"
                                            />
                                            <Monitor size={18} />
                                            <span>Web Desktop</span>
                                        </label>
                                    </div>
                                </div>

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
                                            <option value="Multi-Language">Multi-Language</option>
                                            {/* Dynamic Languages */}
                                            {(allLanguages || []).filter(l => l !== 'Multi-Language').map(lang => (
                                                <option key={lang} value={lang}>{lang}</option>
                                            ))}
                                            <option value="NEW">+ Create New Language</option>
                                        </select>
                                        {formData.language === 'NEW' && (
                                            <input
                                                type="text"
                                                className="form-input mt-2"
                                                placeholder="Enter new language name (e.g. Spanish)"
                                                onChange={(e) => setFormData(prev => ({ ...prev, newLanguageName: e.target.value }))}
                                            />
                                        )}
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

            {/* Feedbacks Modal */}
            {isFeedbackModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '800px' }}>
                        <div className="modal-header">
                            <h3>Active Feedbacks</h3>
                            <button className="close-btn" onClick={() => setIsFeedbackModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="tabs-header mb-6">
                                <button
                                    className={`tab-btn ${feedbackTab === 'active' ? 'active' : ''}`}
                                    onClick={() => setFeedbackTab('active')}
                                >
                                    Active Reports ({feedbackCount})
                                </button>
                                <button
                                    className={`tab-btn ${feedbackTab === 'history' ? 'active' : ''}`}
                                    onClick={() => setFeedbackTab('history')}
                                >
                                    Resolution History
                                </button>
                            </div>

                            {groupedFeedbacks.length === 0 ? (
                                <div className="text-center py-8 text-muted">
                                    {feedbackTab === 'active' ? "No active feedbacks! Great job." : "No resolution history yet."}
                                </div>
                            ) : (
                                <div className="feedback-list">
                                    {groupedFeedbacks.map(group => (
                                        <div key={group.item.id || Math.random()} className="feedback-item-group">
                                            <div className="feedback-item-header">
                                                <img src={group.item.image} alt="" className="feedback-thumb" />
                                                <div className="flex-1">
                                                    <h4 className="font-bold">{group.item.title}</h4>
                                                    <p className="text-xs text-muted">ID: {group.item.id} | Topic: {group.item.topic}</p>
                                                </div>
                                            </div>
                                            <div className="feedback-messages">
                                                {group.feedbacks.map(fb => (
                                                    <div key={fb.id} className="feedback-message-row">
                                                        <div className="flex-1">
                                                            <p className="feedback-text line-clamp-2" title={fb.message}>{fb.message}</p>
                                                            <div className="flex justify-between items-center">
                                                                <p className="text-xs text-muted">{new Date(fb.timestamp).toLocaleString()}</p>
                                                                {fb.resolvedAt && (
                                                                    <p className="text-xs text-green-600 font-semibold italic">
                                                                        Resolved: {new Date(fb.resolvedAt).toLocaleString()}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {fb.status === 'active' && (
                                                            <button
                                                                className="btn btn-xs btn-success ml-4"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleResolveFeedback(fb.id);
                                                                }}
                                                                title="Mark as Fixed / Resolved"
                                                            >
                                                                <CheckCircle size={14} className="mr-1" /> Resolve
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setIsFeedbackModalOpen(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
