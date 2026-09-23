/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState, useMemo } from 'react';
import bundledData from '../data/data.json';
import { getTopics } from '../domain/topics';

const DataContext = createContext();
// Same-origin copy of src/data/data.json, placed in the build output by the
// copy-live-data plugin in vite.config.js. The repo is PRIVATE (2026-06-11),
// so raw.githubusercontent.com can no longer serve it — but the Pages site is
// public and redeploys on every Admin Unified Sync push, so this stays fresh.
const DATA_URL = `${import.meta.env.BASE_URL}data.json`;

export function DataProvider({ children }) {
    const [items, setItems] = useState(bundledData); // Start with bundled data
    const [isLoading, setIsLoading] = useState(true);

    const [favorites, setFavorites] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('fd_favorites')) || [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        const loadLines = async () => {
            try {
                const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
                if (!response.ok) throw new Error('Failed to fetch data');
                const liveData = await response.json();
                setItems(liveData.map((item, index) => ({ ...item, id: item.id || Date.now() + index })));
                setIsLoading(false);


            } catch (err) {
                console.warn("Critical data fetch failed:", err);
                setItems(bundledData);
                setIsLoading(false);
            }
        };

        loadLines();
    }, []);

    useEffect(() => {
        localStorage.setItem('fd_favorites', JSON.stringify(favorites));
    }, [favorites]);

    const toggleFavorite = (title) => {
        setFavorites(prev =>
            prev.includes(title)
                ? prev.filter(t => t !== title)
                : [...prev, title]
        );
    };

    const isFavorite = (title) => favorites.includes(title);

    // --- Admin Actions ---
    const addItem = (newItem) => {
        const itemWithId = { ...newItem, id: newItem.id || Date.now() };
        setItems(prev => [itemWithId, ...prev]);
    };

    const updateItem = (id, updatedItem) => {
        setItems(prev => prev.map(item => item.id === id ? { ...updatedItem, id } : item));
    };

    const deleteItem = (id) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };


    const getJson = () => JSON.stringify(items, null, 2);

    const replaceItems = useCallback((nextItems) => setItems(Array.isArray(nextItems) ? nextItems : []), []);
    const upsertCanonicalItem = useCallback((item) => setItems((current) => {
        const exists = current.some((entry) => String(entry.id) === String(item.id));
        return exists ? current.map((entry) => String(entry.id) === String(item.id) ? item : entry) : [item, ...current];
    }), []);


    // Derived lists
    const allTopics = useMemo(() => getTopics(items), [items]);
    const allLanguages = useMemo(() => Array.from(new Set(items.map(i => i.language))).sort(), [items]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-blue-400 font-medium">Initializing Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <DataContext.Provider value={{
            items,
            favorites,
            toggleFavorite,
            isFavorite,
            allTopics,
            allLanguages,
            addItem,
            updateItem,
            deleteItem,
            replaceItems,
            upsertCanonicalItem,
            getJson,
            isLoading // Export loading state too
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    return useContext(DataContext);
}
