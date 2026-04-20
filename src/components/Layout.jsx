import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useRequestModal } from '../contexts/RequestModalContext';
import { Moon, Sun, ShieldCheck, Settings, BarChart2, MessageSquarePlus } from 'lucide-react';
import { MarketTicker } from './MarketTicker';
import { RequestScreenshotModal } from './RequestScreenshotModal';

export function Layout() {
    const { theme, toggleTheme } = useTheme();
    const { open: openRequestModal, isOpen: requestModalOpen } = useRequestModal();

    return (
        <div className="app-layout">
            {/* Header */}
            <header className="app-header">
                <div className="container header-content">
                    <Link to="/" className="brand" style={{ textDecoration: 'none' }}>
                        <ShieldCheck className="brand-icon" size={24} />
                        <h1 className="brand-title">FD Screenshot Assistant</h1>
                    </Link>

                    <div className="header-actions">
                        <button
                            onClick={() => openRequestModal()}
                            className="btn btn-request"
                            title="Request a screenshot"
                        >
                            <MessageSquarePlus size={16} />
                            <span className="btn-request-label">Request Screenshot</span>
                        </button>

                        <Link to="/analytics" className="theme-toggle" title="Analytics Dashboard">
                            <BarChart2 size={20} />
                        </Link>

                        <Link to="/admin" className="theme-toggle" title="Admin Panel">
                            <Settings size={20} />
                        </Link>

                        <button
                            onClick={toggleTheme}
                            className="theme-toggle"
                            title="Toggle Theme"
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Market Ticker */}
            <MarketTicker />

            {/* Main Content */}
            <main className="container main-content">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="app-footer">
                <p>FD Screenshot Assistant – Internal Use Only</p>
            </footer>

            {requestModalOpen && <RequestScreenshotModal />}
        </div>
    );
}
