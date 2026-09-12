import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AccessGate } from '../components/AccessGate';
import { AppIcon } from '../components/AppIcon';
import { RequestWorkflow } from '../components/requests/RequestWorkflow';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { fetchInteractionStats, fetchSurveyResponses, getLibraryStats } from '../services/analytics';

const COLORS = ['#2563eb', '#d49a24', '#16a085', '#7c5ac7', '#d95f76', '#2296a8', '#718096'];
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1YmwQeGtO2-y6FVbyYFM8Moq0xuvVlZ4_IQPZb-CG6HQ/edit';
const responseTime = (row) => {
    const value = row.submitted_at || row.timestamp;
    return value ? new Date(value).toLocaleString() : 'Time unavailable';
};

function Metric({ icon, label, value, detail }) {
    return <article className="insight-metric"><span className="insight-metric-icon"><AppIcon name={icon} size={17} /></span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>;
}

function DataState({ loading, error, empty, onRetry }) {
    if (loading) return <div className="insight-state"><span className="spinner" /><p>Reading the latest responses…</p></div>;
    if (error) return <div className="insight-state error"><AppIcon name="Activity" size={24} /><h3>Data could not be loaded</h3><p>{error}</p><button type="button" className="button button-quiet" onClick={onRetry}>Try again</button></div>;
    if (empty) return <div className="insight-state"><AppIcon name="ClipboardList" size={25} /><h3>Nothing submitted yet</h3><p>New responses will appear here automatically.</p></div>;
    return null;
}

function Insights() {
    const auth = useAuth();
    const { items } = useData();
    const [activeTab, setActiveTab] = useState(() => auth.isOwner ? 'overview' : 'requests');
    const [interaction, setInteraction] = useState(null);
    const [surveys, setSurveys] = useState(null);
    const [surveyError, setSurveyError] = useState('');
    const [query, setQuery] = useState('');

    useEffect(() => { if (!auth.isOwner) return undefined; let alive = true; fetchInteractionStats().then((value) => alive && setInteraction(value)); return () => { alive = false; }; }, [auth.isOwner]);
    useEffect(() => {
        if (!auth.isOwner || activeTab !== 'surveys' || surveys !== null || surveyError) return undefined;
        let alive = true;
        fetchSurveyResponses().then((rows) => alive && setSurveys(rows)).catch((error) => alive && setSurveyError(error.message));
        return () => { alive = false; };
    }, [activeTab, auth.isOwner, surveyError, surveys]);

    const stats = useMemo(() => getLibraryStats(items, interaction), [items, interaction]);
    const filteredSurveys = useMemo(() => (surveys || []).filter((row) => !query || Object.values(row).some((value) => String(value || '').toLowerCase().includes(query.toLowerCase()))), [query, surveys]);
    const surveySummary = useMemo(() => {
        const values = surveys || [];
        const average = (field) => { const nums = values.map((row) => Number(row[field])).filter((value) => value >= 1 && value <= 5); return nums.length ? (nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(1) : '—'; };
        return { count: values.length, satisfaction: average('satisfaction'), search: average('search_ease') };
    }, [surveys]);

    const retrySurvey = async () => {
        setSurveyError(''); setSurveys(null);
        try { setSurveys(await fetchSurveyResponses()); } catch (error) { setSurveyError(error.message); }
    };

    const tabs = auth.isOwner
        ? [['overview', 'BarChart3', 'Overview'], ['requests', 'MessageSquarePlus', 'Requests'], ['surveys', 'ClipboardList', 'Survey']]
        : [['requests', 'MessageSquarePlus', 'Requests']];

    return <div className="insights-page animate-in">
        <header className="insights-header"><div><span className="eyebrow"><AppIcon name="BarChart3" size={13} /> {auth.isOwner ? 'Owner intelligence' : 'Contributor operations'}</span><h1>{auth.isOwner ? 'Library signals' : 'Request queue'}</h1><p>{auth.isOwner ? 'Content coverage, agent demand, and experience feedback in one editorial view.' : 'Assign, resolve, and link screenshot requests in the shared workspace.'}</p></div>{auth.isOwner && <a href={SHEET_URL} target="_blank" rel="noreferrer" className="button button-quiet"><AppIcon name="ExternalLink" size={15} /> Raw responses</a>}</header>
        <nav className="insight-tabs">{tabs.map(([id, icon, label]) => <button type="button" key={id} className={activeTab === id ? 'active' : ''} onClick={() => { setActiveTab(id); setQuery(''); }}><AppIcon name={icon} size={15} />{label}</button>)}</nav>

        {activeTab === 'overview' && auth.isOwner && <>
            <div className="insight-metrics"><Metric icon="FileImage" label="Published guides" value={stats.totalItems} detail="Current catalog coverage" /><Metric icon="UsersRound" label="Unique visitors" value={stats.uniqueUsers ?? '—'} detail="Tracked devices" /><Metric icon="Activity" label="Interactions" value={stats.totalEvents ?? '—'} detail="Views and copy actions" /><Metric icon="Languages" label="Languages" value={stats.langData.length} detail="Across the entire library" /></div>
            <div className="insight-charts"><section className="insight-chart"><div className="panel-heading"><div><span className="eyebrow">Coverage mix</span><h2>Topics</h2></div><strong>{stats.topicData.length}</strong></div><div className="chart-wrapper"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 480, height: 300 }}><PieChart><Pie data={stats.topicData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2}>{stats.topicData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="chart-legend">{stats.topicData.map((entry, index) => <span key={entry.name}><i style={{ background: COLORS[index % COLORS.length] }} />{entry.name}<b>{entry.value}</b></span>)}</div></section>
                <section className="insight-chart"><div className="panel-heading"><div><span className="eyebrow">Localization</span><h2>Language coverage</h2></div></div><div className="chart-wrapper"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 480, height: 300 }}><BarChart data={stats.langData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}><CartesianGrid stroke="var(--line-1)" vertical={false} /><XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 9 }} angle={-25} textAnchor="end" height={55} /><YAxis tick={{ fill: 'var(--text-3)', fontSize: 9 }} /><Tooltip /><Bar dataKey="count" fill="var(--accent)" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></section></div>
            <section className="signal-callout"><AppIcon name="Sparkles" size={19} /><div><strong>{stats.topScreenshot && stats.topScreenshot !== 'N/A' ? stats.topScreenshot : 'Interaction data is warming up'}</strong><p>{stats.topScreenshot && stats.topScreenshot !== 'N/A' ? 'This is currently the most interacted-with screenshot.' : 'The catalog view remains complete while anonymous interaction totals are unavailable.'}</p></div></section>
        </>}

        {activeTab === 'requests' && <RequestWorkflow />}

        {activeTab === 'surveys' && auth.isOwner && <section className="response-workspace"><div className="response-toolbar"><div><span className="eyebrow">Agent experience</span><h2>Survey responses</h2></div><label className="studio-search"><AppIcon name="Search" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter every field…" /></label><button type="button" className="icon-button" onClick={retrySurvey}><AppIcon name="RefreshCw" size={16} /></button></div>
            {surveys && <div className="survey-signal-row"><Metric icon="ClipboardList" label="Responses" value={surveySummary.count} detail="Completed surveys" /><Metric icon="Sparkles" label="Satisfaction" value={`${surveySummary.satisfaction} / 5`} detail="Average rating" /><Metric icon="Search" label="Search ease" value={`${surveySummary.search} / 5`} detail="Average rating" /></div>}
            <DataState loading={surveys === null && !surveyError} error={surveyError} empty={surveys?.length === 0} onRetry={retrySurvey} />
            {filteredSurveys.length > 0 && <div className="response-list">{filteredSurveys.map((row, index) => <article className="response-card survey-response-card" key={row.submitted_at || index}><header><div><span className="response-type">{row.usage_frequency || 'Survey'}</span><strong>{row.top_feature || 'No headline suggestion'}</strong></div><time>{responseTime(row)}</time></header><p>{row.biggest_frustration || row.other_feedback || 'No written feedback.'}</p><footer><span>Satisfaction {row.satisfaction || '—'}/5</span><span>Search {row.search_ease || '—'}/5</span><span>{row.languages_needed || 'No language request'}</span></footer></article>)}</div>}
        </section>}
    </div>;
}

export function AnalyticsPage() {
    return <AccessGate title="Library analytics"><Insights /></AccessGate>;
}
