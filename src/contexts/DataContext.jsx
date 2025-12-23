import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import bundledData from '../data/data.json';

const DataContext = createContext();
const BASE_DATA_URL = 'https://raw.githubusercontent.com/GorkemTikic/screenshot-library/main/src/data';
const DATA_URL = `${BASE_DATA_URL}/data.json`;
const FEEDBACKS_URL = `${BASE_DATA_URL}/feedbacks.json`;
import { githubService } from '../services/github';

export function DataProvider({ children }) {
    const [items, setItems] = useState(bundledData); // Start with bundled data
    const [feedbacks, setFeedbacks] = useState([]); // Separate feedback state
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

                // Load feedbacks separately
                try {
                    const fbResponse = await fetch(`${FEEDBACKS_URL}?t=${Date.now()}`);
                    if (fbResponse.ok) {
                        const fbData = await fbResponse.json();
                        setFeedbacks(Array.isArray(fbData) ? fbData : []);
                    }
                } catch (fbErr) {
                    console.warn("Could not load feedbacks.json, starting fresh:", fbErr);
                }

                // Sanitize data and migrate legacy feedbacks
                let legacyFeedbacks = [];
                const sanitizedData = liveData.map((item, index) => {
                    const itemId = item.id || Date.now() + index;
                    if (item.feedbacks && Array.isArray(item.feedbacks)) {
                        const enriched = item.feedbacks.map(fb => ({
                            ...fb,
                            itemId: itemId,
                            status: fb.status || 'active'
                        }));
                        legacyFeedbacks = [...legacyFeedbacks, ...enriched];
                    }
                    return {
                        ...item,
                        id: itemId,
                        feedbacks: undefined // Clear legacy feedbacks from items
                    };
                });

                // Merge legacy with loaded feedbacks (avoid duplicates by ID)
                setFeedbacks(prev => {
                    const existingIds = new Set(prev.map(f => f.id));
                    const newUnique = legacyFeedbacks.filter(f => !existingIds.has(f.id));
                    return [...prev, ...newUnique];
                });

                setItems(sanitizedData);
                console.log("Loaded live data and feedbacks from GitHub. Migrated:", legacyFeedbacks.length);
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
            itemId,
            message,
            status: 'active',
            timestamp: new Date().toISOString()
        };

        setFeedbacks(prev => [newFeedback, ...prev]);
        return feedbackId;
    };

    const resolveFeedback = (feedbackId) => {
        setFeedbacks(prev => prev.map(fb =>
            fb.id === feedbackId
                ? { ...fb, status: 'resolved', resolvedAt: new Date().toISOString() }
                : fb
        ));
    };

    const getJson = () => JSON.stringify(items, null, 2);

    const syncData = async (itemsToSync = items) => {
        if (!githubService.isConfigured()) return false;
        await githubService.updateDataJson(itemsToSync);
        return true;
    };

    const syncFeedbacks = async (feedbacksToSync = feedbacks) => {
        if (!githubService.isConfigured()) return false;
        await githubService.updateJsonFile('src/data/feedbacks.json', feedbacksToSync, "Update feedbacks.json via Admin Panel");
        return true;
    };

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
            feedbacks,
            addFeedback,
            resolveFeedback,
            syncData,
            syncFeedbacks,
            getJson
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    return useContext(DataContext);
}
