import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import bundledData from '../data/data.json';
import bundledFeedbacks from '../data/feedbacks.json';

const DataContext = createContext();
const BASE_DATA_URL = 'https://raw.githubusercontent.com/GorkemTikic/screenshot-library/main/src/data';
const DATA_URL = `${BASE_DATA_URL}/data.json`;
const FEEDBACKS_URL = `${BASE_DATA_URL}/feedbacks.json`;
import { githubService } from '../services/github';
import { fetchCloudFeedbacks } from '../services/analytics';

export function DataProvider({ children }) {
    const [items, setItems] = useState(bundledData); // Start with bundled data
    const [feedbacks, setFeedbacks] = useState(bundledFeedbacks); // Start with bundled feedbacks
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
                    console.log("Development mode: Loading local data + cloud feedbacks...");
                    // We still want cloud feedbacks in DEV to test the system!
                    let devCloud = [];
                    try {
                        devCloud = await fetchCloudFeedbacks();
                    } catch (e) {
                        console.warn("Dev cloud fetch failed:", e);
                    }
                    setFeedbacks([...bundledFeedbacks, ...devCloud]);
                    setIsLoading(false);
                    return;
                }
                const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
                if (!response.ok) throw new Error('Failed to fetch live data');
                const liveData = await response.json();

                // Load feedbacks separately
                let remoteFeedbacks = [];
                try {
                    // If we have GitHub configured, use API to get freshest data
                    if (githubService.isConfigured()) {
                        const { owner, repo } = githubService.getConfig();
                        const url = `https://api.github.com/repos/${owner}/${repo}/contents/src/data/feedbacks.json?t=${Date.now()}`;
                        const fbApiRes = await fetch(url, {
                            headers: githubService.getHeaders(),
                            cache: 'no-store'
                        });
                        if (fbApiRes.ok) {
                            const fbFile = await fbApiRes.json();
                            const decoded = decodeURIComponent(escape(atob(fbFile.content)));
                            remoteFeedbacks = JSON.parse(decoded);
                        }
                    } else {
                        // Public view: Use RAW URL with cache busting
                        const fbResponse = await fetch(`${FEEDBACKS_URL}?t=${Date.now()}`);
                        if (fbResponse.ok) {
                            remoteFeedbacks = await fbResponse.json();
                        }
                    }
                } catch (fbErr) {
                    console.warn("Could not load feedbacks from Git, starting with fresh or cloud data:", fbErr);
                }

                // --- CLOUD FEEDBACKS ---
                let cloudFeedbacks = [];
                try {
                    cloudFeedbacks = await fetchCloudFeedbacks();
                } catch (cErr) {
                    console.warn("Could not load cloud feedbacks:", cErr);
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

                // Final Merge: remote(git) + legacy + cloud
                const mergedFeedbacks = [...(Array.isArray(remoteFeedbacks) ? remoteFeedbacks : [])];
                const existingIds = new Set(mergedFeedbacks.map(f => f.id));

                // Add legacy
                legacyFeedbacks.forEach(fb => {
                    if (!existingIds.has(fb.id)) mergedFeedbacks.push(fb);
                });

                // Add cloud (and link to itemId by title)
                cloudFeedbacks.forEach(cfb => {
                    // Try to finding matching item if itemId is 0
                    if (cfb.itemId === 0 && cfb.title) {
                        const match = sanitizedData.find(i => i.title === cfb.title);
                        if (match) cfb.itemId = match.id;
                    }
                    // Since Git-sync gives them real IDs later, we only add if not already in Git
                    // (Actually, cloud is 'new', Git is 'confirmed'. We can show both or filter duplicates)
                    // For now, let's add them all, but keep track of source.
                    mergedFeedbacks.push(cfb);
                });

                // Sort by timestamp newest first
                mergedFeedbacks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                setFeedbacks(mergedFeedbacks);
                setItems(sanitizedData);
                console.log("Loaded total feedbacks:", mergedFeedbacks.length);
            } catch (err) {
                console.warn("Data fetch failed:", err);
                setFetchError(err.message);
                // Fallback to bundled data
                setItems(bundledData.map((item, index) => ({
                    ...item,
                    id: item.id || Date.now() + index
                })));
                setFeedbacks(bundledFeedbacks);
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
        return newFeedback;
    };

    const resolveFeedback = (feedbackId) => {
        const updated = feedbacks.map(fb =>
            fb.id === feedbackId
                ? { ...fb, status: 'resolved', resolvedAt: new Date().toISOString() }
                : fb
        );
        setFeedbacks(updated);
        return updated;
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
            feedbacks,
            addFeedback,
            resolveFeedback,
            syncData,
            syncFeedbacks,
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
