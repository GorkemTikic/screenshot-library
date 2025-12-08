import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { Moon, Sun, Monitor, Settings, BarChart2 } from 'lucide-react';

export function Layout() {
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();

    return (
        <div className="app-layout">
            {/* Header */}
            <header className="app-header">
                <div className="container header-content">
                    <Link to="/" className="brand" style={{ textDecoration: 'none' }}>
                        <Monitor className="brand-icon" size={24} />
                        <h1 className="brand-title">FD Screenshot Assistant</h1>
                    </Link>

                    <div className="header-actions">
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

            {/* Main Content */}
            <main className="container main-content">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="app-footer">
                <p>FD Screenshot Assistant – Internal Use Only</p>
            </footer>
        </div>
    );
}
