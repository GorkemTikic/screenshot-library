import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { getLibraryStats, fetchInteractionStats, fetchScreenshotRequests } from '../services/analytics';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart2, PieChart as PieIcon, Globe, Image as ImageIcon, Database, Users, MousePointer2, MessageSquarePlus, ExternalLink, Info, RefreshCw, AlertTriangle, Inbox } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const REQUESTS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1YmwQeGtO2-y6FVbyYFM8Moq0xuvVlZ4_IQPZb-CG6HQ/edit';

export function AnalyticsPage() {
    const { items } = useData();
    const [stats, setStats] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    const [requests, setRequests] = useState([]);
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [requestsError, setRequestsError] = useState('');
    const [requestFilter, setRequestFilter] = useState('');

    useEffect(() => {
        const loadStats = async () => {
            if (items.length > 0) {
                // Fetch interaction data if available
                const interactionData = await fetchInteractionStats();
                setStats(getLibraryStats(items, interactionData));
            }
        };
        loadStats();
    }, [items]);

    const loadRequests = useCallback(async () => {
        setRequestsLoading(true);
        setRequestsError('');
        try {
            const rows = await fetchScreenshotRequests();
            const sorted = [...rows].sort((a, b) => {
                const ta = new Date(a.submitted_at || a.timestamp || 0).getTime();
                const tb = new Date(b.submitted_at || b.timestamp || 0).getTime();
                return tb - ta;
            });
            setRequests(sorted);
        } catch (err) {
            setRequestsError(err.message || 'Failed to load requests');
        } finally {
            setRequestsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && activeTab === 'requests' && requests.length === 0 && !requestsError) {
            loadRequests();
        }
    }, [isAuthenticated, activeTab, requests.length, requestsError, loadRequests]);

    const filteredRequests = useMemo(() => {
        if (!requestFilter.trim()) return requests;
        const q = requestFilter.trim().toLowerCase();
        return requests.filter(r =>
            Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q))
        );
    }, [requests, requestFilter]);

    // Auth Check
    if (!isAuthenticated) {
        return (
            <div className="auth-container animate-in">
                <div className="auth-card">
                    <div className="auth-icon-wrapper">
                        <BarChart2 size={24} />
                    </div>
                    <h2 className="auth-title">Analytics Dashboard</h2>
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
                        Access Data
                    </button>
                </div>
            </div>
        );
    }

    if (!stats) return (
        <div className="analytics-loading">
            <div className="spinner"></div>
            <p>Gathering library insights...</p>
        </div>
    );

    return (
        <div className="analytics-container animate-in">
            <div className="analytics-header">
                <div>
                    <h2 className="page-title">Analytics Dashboard</h2>
                    <p className="text-muted">Real-time stats based on current content library & user activity</p>
                </div>
                <div className="header-actions">
                    <a
                        href="https://docs.google.com/spreadsheets/d/1YmwQeGtO2-y6FVbyYFM8Moq0xuvVlZ4_IQPZb-CG6HQ/edit"
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-success"
                    >
                        <Database size={16} className="mr-2" /> Open Raw Database
                    </a>
                </div>
            </div>

            {/* Tabs */}
            <div className="analytics-tabs">
                <button
                    className={`analytics-tab ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <BarChart2 size={16} /> Overview
                </button>
                <button
                    className={`analytics-tab ${activeTab === 'requests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('requests')}
                >
                    <MessageSquarePlus size={16} /> Screenshot Requests
                </button>
            </div>

            {activeTab === 'overview' && (
                <>
                    {/* KPI Cards */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon blue">
                                <ImageIcon size={24} />
                            </div>
                            <div>
                                <p className="stat-label">Total Screenshots</p>
                                <h3 className="stat-value">{stats.totalItems}</h3>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon purple">
                                <Users size={24} />
                            </div>
                            <div>
                                <p className="stat-label">Total Visitors</p>
                                <h3 className="stat-value">{stats.uniqueUsers !== null ? stats.uniqueUsers : 'Scanning...'}</h3>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon yellow">
                                <MousePointer2 size={24} />
                            </div>
                            <div style={{ maxWidth: '180px' }}>
                                <p className="stat-label">Top Interaction</p>
                                <h3 className="stat-value text-truncate" title={stats.topScreenshot} style={{ fontSize: stats.topScreenshot?.length > 15 ? '1rem' : '1.2rem' }}>
                                    {stats.topScreenshot || 'N/A'}
                                </h3>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon orange">
                                <Globe size={24} />
                            </div>
                            <div>
                                <p className="stat-label">Languages</p>
                                <h3 className="stat-value">{stats.langData.length}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="charts-grid">
                        {/* Topic Distribution */}
                        <div className="chart-card">
                            <h3 className="chart-title">
                                <PieIcon size={18} className="icon-muted" /> Content by Topic
                            </h3>
                            <div className="chart-wrapper">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.topicData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={true}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={65}
                                            innerRadius={40}
                                            paddingAngle={2}
                                            minAngle={15}
                                            dataKey="value"
                                        >
                                            {stats.topicData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)', borderRadius: '8px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Language Distribution */}
                        <div className="chart-card">
                            <h3 className="chart-title">
                                <Globe size={18} className="icon-muted" /> Language Breakdown
                            </h3>
                            <div className="chart-wrapper">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.langData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                        <XAxis dataKey="name" stroke="#888" fontSize={10} angle={-45} textAnchor="end" height={50} />
                                        <YAxis stroke="#888" fontSize={12} />
                                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)', borderRadius: '8px' }} />
                                        <Bar dataKey="count" fill="#FCD535" radius={[4, 4, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Note Section */}
                    <div className="info-box">
                        <div className="info-icon">💡</div>
                        <div>
                            <strong>Analytics Tip:</strong> This dashboard now combines library metadata with user interaction logs. The <strong>"Total Visitors"</strong> count is based on unique device IDs tracked since the implementation of the tracking script.
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'requests' && (
                <div className="requests-panel">
                    <div className="requests-toolbar">
                        <div>
                            <h3 className="requests-title">
                                <MessageSquarePlus size={20} /> Screenshot Requests
                                {requests.length > 0 && (
                                    <span className="requests-count">{requests.length}</span>
                                )}
                            </h3>
                            <p className="text-muted requests-subtitle">
                                Submitted by any agent, from any device, no token required.
                            </p>
                        </div>
                        <div className="requests-toolbar-actions">
                            <input
                                type="text"
                                className="form-input requests-filter"
                                placeholder="Filter requests..."
                                value={requestFilter}
                                onChange={e => setRequestFilter(e.target.value)}
                            />
                            <button
                                className="btn btn-secondary"
                                onClick={loadRequests}
                                disabled={requestsLoading}
                                title="Refresh"
                            >
                                <RefreshCw size={16} className={requestsLoading ? 'spinning' : ''} />
                                Refresh
                            </button>
                            <a
                                href={REQUESTS_SHEET_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary"
                                title="Open the sheet directly"
                            >
                                <ExternalLink size={16} /> Sheet
                            </a>
                        </div>
                    </div>

                    {requestsLoading && requests.length === 0 && (
                        <div className="requests-state">
                            <div className="spinner"></div>
                            <p>Loading requests…</p>
                        </div>
                    )}

                    {requestsError && (
                        <div className="requests-error-card">
                            <div className="requests-error-header">
                                <AlertTriangle size={18} />
                                <strong>Couldn't load requests</strong>
                            </div>
                            <p className="text-muted">{requestsError}</p>
                            <details className="requests-setup">
                                <summary>Setup: add the <code>getRequests</code> endpoint to your Apps Script</summary>
                                <ol>
                                    <li>Open your Apps Script (linked from the sheet → <em>Extensions → Apps Script</em>).</li>
                                    <li>Paste the <code>handleScreenshotRequest</code> and <code>getRequests</code> helpers from the PR description.</li>
                                    <li>Click <strong>Deploy → Manage Deployments → Edit → New Version → Deploy</strong>.</li>
                                    <li>Come back and hit Refresh.</li>
                                </ol>
                            </details>
                            <button className="btn btn-secondary" onClick={loadRequests}>
                                <RefreshCw size={16} /> Try again
                            </button>
                        </div>
                    )}

                    {!requestsLoading && !requestsError && requests.length === 0 && (
                        <div className="requests-state">
                            <Inbox size={40} className="icon-muted" />
                            <p>No requests yet.</p>
                            <p className="text-muted">When an agent submits a request, it'll appear here.</p>
                        </div>
                    )}

                    {!requestsError && filteredRequests.length > 0 && (
                        <div className="requests-table-wrap">
                            <table className="requests-table">
                                <thead>
                                    <tr>
                                        <th>When</th>
                                        <th>Topic</th>
                                        <th>Lang</th>
                                        <th>Platform</th>
                                        <th>Description</th>
                                        <th>Context</th>
                                        <th>Searched</th>
                                        <th>Device</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRequests.map((r, idx) => (
                                        <tr key={`${r.submitted_at || r.timestamp || idx}-${idx}`}>
                                            <td className="col-when" title={r.submitted_at || r.timestamp}>
                                                {formatRequestTime(r.submitted_at || r.timestamp)}
                                            </td>
                                            <td><span className="req-pill">{r.topic || '—'}</span></td>
                                            <td>{r.language || r.req_language || '—'}</td>
                                            <td>{r.platform || r.req_platform || '—'}</td>
                                            <td className="col-desc">{r.description || r.req_description || '—'}</td>
                                            <td className="col-ctx">{r.context || r.req_context || ''}</td>
                                            <td className="col-search">{r.search_terms || r.req_search_terms || ''}</td>
                                            <td className="col-device"><code>{(r.device_hash || r.hash || '').slice(0, 8)}</code></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!requestsError && requests.length > 0 && filteredRequests.length === 0 && (
                        <div className="requests-state">
                            <p className="text-muted">No requests match "{requestFilter}".</p>
                        </div>
                    )}

                    <div className="info-box">
                        <div className="info-icon"><Info size={18} /></div>
                        <div>
                            This tab reads directly from a dedicated <strong>Screenshot Requests</strong> tab in the spreadsheet.
                            Data is cross-device and available to any admin on any browser.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function formatRequestTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const now = Date.now();
    const diff = now - d.getTime();
    const min = 60 * 1000;
    const hr = 60 * min;
    const day = 24 * hr;
    if (diff < min) return 'just now';
    if (diff < hr) return `${Math.floor(diff / min)}m ago`;
    if (diff < day) return `${Math.floor(diff / hr)}h ago`;
    if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
    return d.toLocaleString();
}
