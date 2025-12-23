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
                // Fetch live data with cache busting ONLY in production
                if (import.meta.env.DEV) {
                    console.log("Development mode: Using local data");
                    setIsLoading(false);
                    return;
                }
                const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
                if (!response.ok) throw new Error('Failed to fetch live data');
                const liveData = await response.json();

                // Sanitize data: Ensure every item has an ID
                const sanitizedData = liveData.map((item, index) => ({
                    ...item,
                    id: item.id || Date.now() + index
                }));

                setItems(sanitizedData);
                console.log("Loaded live data from GitHub");
            } catch (err) {
                console.warn("Live data fetch failed, using bundled data:", err);
                setFetchError(err.message);
                // Fallback to bundled data, but also sanitize it
                setItems(prev => prev.map((item, index) => ({
                    ...item,
                    id: item.id || Date.now() + index
                })));
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
        const itemWithId = { ...newItem, id: newItem.id || Date.now() };
        setItems(prev => [itemWithId, ...prev]);
    };

    const updateItem = (id, updatedItem) => {
        setItems(prev => prev.map(item => item.id === id ? { ...updatedItem, id } : item));
    };

    const deleteItem = (id) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const addFeedback = (itemId, message) => {
        const feedbackId = Date.now();
        const newFeedback = {
            id: feedbackId,
            message,
            status: 'active',
            timestamp: new Date().toISOString()
        };

        setItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const existingFeedbacks = item.feedbacks || [];
                return { ...item, feedbacks: [...existingFeedbacks, newFeedback] };
            }
            return item;
        }));

        return feedbackId;
    };

    const resolveFeedback = (itemId, feedbackId) => {
        setItems(prev => prev.map(item => {
            if (item.id === itemId && item.feedbacks) {
                return {
                    ...item,
                    feedbacks: item.feedbacks.map(fb =>
                        fb.id === feedbackId
                            ? { ...fb, status: 'resolved', resolvedAt: new Date().toISOString() }
                            : fb
                    )
                };
            }
            return item;
        }));
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
            addFeedback,
            resolveFeedback,
            getJson
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    return useContext(DataContext);
}
