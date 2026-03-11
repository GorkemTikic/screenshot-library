import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import bundledData from '../data/data.json';

const DataContext = createContext();
const BASE_DATA_URL = 'https://raw.githubusercontent.com/GorkemTikic/screenshot-library/main/src/data';
const DATA_URL = `${BASE_DATA_URL}/data.json`;
import { githubService } from '../services/github';

export function DataProvider({ children }) {
    const [items, setItems] = useState(bundledData); // Start with bundled data
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

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
                // --- PERSISTENCE LOAD ---
                // Fetch live data with cache busting
                // In DEV mode, we only fetch if GitHub is configured to avoid local-to-remote confusion
                // unless we are explicitly trying to sync.
                const shouldFetchRemote = !import.meta.env.DEV || githubService.isConfigured();

                if (shouldFetchRemote) {
                    const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
                    if (!response.ok) throw new Error('Failed to fetch data');
                    const liveData = await response.json();

                    // Sanitize and set Items IMMEDIATELY to clear loading screen
                    const sanitizedData = liveData.map((item, index) => ({
                        ...item,
                        id: item.id || Date.now() + index
                    }));
                    setItems(sanitizedData);
                } else {
                    console.log("Development mode (unconfigured): Using bundled data.");
                    setItems(bundledData);
                }
                setIsLoading(false);


            } catch (err) {
                console.warn("Critical data fetch failed:", err);
                setFetchError(err.message);
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

    // Atomic Update Bridge
    const performAtomicUpdate = async (action, item) => {
        if (!githubService.isConfigured()) return;
        const newItems = await githubService.atomicUpdateDataJson(action, item);
        if (newItems) {
            setItems(newItems);
        }
        return newItems;
    };


    // Derived lists
    const allTopics = useMemo(() => Array.from(new Set(items.map(i => i.topic).filter(Boolean))).sort(), [items]);
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
            performAtomicUpdate,
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
