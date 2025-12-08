import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { getLibraryStats } from '../services/analytics';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Lock, BarChart2, PieChart as PieIcon, Globe, Image as ImageIcon, Database } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export function AnalyticsPage() {
    const { items, getJson } = useData();
    const [stats, setStats] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (items.length > 0) {
            setStats(getLibraryStats(items));
        }
    }, [items]);

    // Auth Check (Same as Admin)
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

    if (!stats) return <div>Loading interactions...</div>;

    return (
        <div className="analytics-container animate-in">
            <div className="analytics-header">
                <div>
                    <h2 className="page-title">Analytics Dashboard</h2>
                    <p className="text-muted">Real-time stats based on current content library</p>
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
                    <div className="stat-icon green">
                        <PieIcon size={24} />
                    </div>
                    <div>
                        <p className="stat-label">Active Topics</p>
                        <h3 className="stat-value">{stats.topicData.length}</h3>
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
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {stats.topicData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Language Distribution */}
                <div className="chart-card">
                    <h3 className="chart-title">
                        <Globe size={18} className="icon-muted" /> Content by Language
                    </h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.langData}>
                                <XAxis dataKey="name" stroke="#888" fontSize={12} />
                                <YAxis stroke="#888" fontSize={12} />
                                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
                                <Bar dataKey="count" fill="#FCD535" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Note Section */}
            <div className="info-box">
                <div className="info-icon">⚠️</div>
                <div>
                    <strong>Note on Tracking:</strong> User interactions (clicks, views) are being logged securely to the <a href="https://docs.google.com/spreadsheets/d/1YmwQeGtO2-y6FVbyYFM8Moq0xuvVlZ4_IQPZb-CG6HQ/edit" className="link-bold" target="_blank">Google Database</a> in real-time. This dashboard currently visualizes the <em>library content structure</em>. To view historical click data, please access the raw database.
                </div>
            </div>
        </div>
    );
}
