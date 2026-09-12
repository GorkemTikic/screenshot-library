import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useRequestModal } from '../contexts/RequestModalContext';
import { useSurveyModal } from '../contexts/SurveyModalContext';
import { useAuth } from '../contexts/AuthContext';
import { AppIcon } from './AppIcon';
import { MarketTicker } from './MarketTicker';
import { RequestScreenshotModal } from './RequestScreenshotModal';
import { SurveyModal } from './SurveyModal';

const navigation = [
    { to: '/', label: 'Library', end: true },
    { to: '/analytics', label: 'Analytics' },
    { to: '/owners', label: 'Owners' },
];

export function Layout() {
    const { theme, toggleTheme } = useTheme();
    const { open: openRequestModal, isOpen: requestModalOpen } = useRequestModal();
    const { open: openSurveyModal, isOpen: surveyModalOpen } = useSurveyModal();
    const auth = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="app-layout">
            <header className="app-header">
                <div className="shell header-content">
                    <NavLink to="/" className="brand" onClick={() => setMenuOpen(false)}>
                        <span className="brand-mark">FD</span>
                        <span className="brand-copy">
                            <strong>Screenshot Library</strong>
                            <small>Financial Derivatives · Support workspace</small>
                        </span>
                    </NavLink>

                    <button
                        type="button"
                        className="icon-button mobile-menu-button"
                        aria-label="Toggle navigation"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        <AppIcon name={menuOpen ? 'X' : 'Menu'} />
                    </button>

                    <div className={`header-panel ${menuOpen ? 'is-open' : ''}`}>
                        <nav className="primary-nav" aria-label="Primary navigation">
                            {navigation.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                                    onClick={() => setMenuOpen(false)}
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </nav>

                        <div className="header-actions">
                            <button type="button" className="button button-quiet" onClick={() => openSurveyModal()}>
                                <AppIcon name="ClipboardList" size={16} />
                                <span>Feedback</span>
                            </button>
                            <button type="button" className="button button-primary" onClick={() => openRequestModal()}>
                                <AppIcon name="MessageSquarePlus" size={16} />
                                <span>Request screenshot</span>
                            </button>
                            <NavLink to="/admin" className="icon-button" aria-label="Open Content Studio" title="Content Studio">
                                <AppIcon name="Settings2" />
                            </NavLink>
                            {auth.status === 'authenticated' && (
                                <button type="button" className="contributor-chip" onClick={() => auth.logout()} title="Sign out">
                                    <span>{auth.principal.displayName}</span>
                                    <small>{auth.principal.role}</small>
                                </button>
                            )}
                            <button type="button" className="icon-button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
                                <AppIcon name={theme === 'dark' ? 'Sun' : 'Moon'} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <MarketTicker />

            <main className="shell main-content">
                <Outlet />
            </main>

            <footer className="app-footer">
                <div className="shell footer-content">
                    <span className="footer-brand"><span className="status-dot" /> FD Screenshot Library</span>
                    <span>Internal support workspace</span>
                </div>
            </footer>

            {requestModalOpen && <RequestScreenshotModal />}
            {surveyModalOpen && <SurveyModal />}
        </div>
    );
}
