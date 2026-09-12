/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getInitialTheme, nextTheme } from '../domain/theme';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        try {
            return getInitialTheme(localStorage.getItem('fd_theme'));
        } catch {
            return 'light';
        }
    });

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#202126' : '#f2f1ee');
        try { localStorage.setItem('fd_theme', theme); } catch { /* private browsing */ }
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => nextTheme(prev));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
