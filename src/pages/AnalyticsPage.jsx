import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { getLibraryStats, fetchInteractionStats } from '../services/analytics';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Lock, BarChart2, PieChart as PieIcon, Globe, Image as ImageIcon, Database, Users, MousePointer2 } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export function AnalyticsPage() {
    const { items, getJson } = useData();
    const [stats, setStats] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');

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
                                    outerRadius={65} // Slightly reduced to give labels more room
                                    innerRadius={40} // Added inner radius for a cleaner look
                                    paddingAngle={2}
                                    minAngle={15} // Ensures small slices are visible and have space for labels
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
        </div>
    );
}
