import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import bundledData from '../data/data.json';

const DataContext = createContext();
const DATA_URL = 'https://raw.githubusercontent.com/GorkemTikic/screenshot-library/main/src/data/data.json';

export function DataProvider({ children }) {
    const [items, setItems] = useState(bundledData); // Start with bundled data (Stale-while-revalidate)
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
                // Fetch live data with cache busting
                const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
                if (!response.ok) throw new Error('Failed to fetch live data');
                const liveData = await response.json();
                setItems(liveData);
                console.log("Loaded live data from GitHub");
            } catch (err) {
                console.warn("Live data fetch failed, using bundled data:", err);
                setFetchError(err.message);
                // items is already bundledData, so no action needed
            } finally {
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
        setItems(prev => [newItem, ...prev]);
    };

    const updateItem = (oldTitle, updatedItem) => {
        setItems(prev => prev.map(item => item.title === oldTitle ? updatedItem : item));
    };

    const deleteItem = (title) => {
        setItems(prev => prev.filter(item => item.title !== title));
    };

    const getJson = () => JSON.stringify(items, null, 2);

    // Derived lists
    const allTopics = useMemo(() => Array.from(new Set(items.map(i => i.topic).filter(Boolean))).sort(), [items]);
    const allLanguages = useMemo(() => Array.from(new Set(items.map(i => i.language))).sort(), [items]);

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
            getJson
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    return useContext(DataContext);
}
