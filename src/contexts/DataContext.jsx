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
                // --- FAST PATH FOR DEV ---
                if (import.meta.env.DEV) {
                    console.log("Development mode: Quick Load...");
                    setItems(bundledData);
                    setFeedbacks(bundledFeedbacks);
                    setIsLoading(false);
                    // Fetch cloud in background
                    fetchCloudFeedbacks().then(cfbs => {
                        if (cfbs.length > 0) {
                            setFeedbacks(prev => {
                                const existingIds = new Set(prev.map(f => f.id));
                                const newOnes = cfbs.filter(f => !existingIds.has(f.id));
                                return [...prev, ...newOnes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                            });
                        }
                    }).catch(console.warn);
                    return;
                }
                // --- PERSISTENCE LOAD (PRODUCTION) ---
                const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
                if (!response.ok) throw new Error('Failed to fetch data');
                const liveData = await response.json();

                // Sanitize and set Items IMMEDIATELY to clear loading screen
                const sanitizedData = liveData.map((item, index) => ({
                    ...item,
                    id: item.id || Date.now() + index
                }));
                setItems(sanitizedData);
                setIsLoading(false); // <--- UNBLOCK UI HERE

                // --- BACKGROUND FEEDBACK LOAD (Does not block UI) ---
                const processFeedbacks = async () => {
                    let allFbs = [];

                    // A. Try Git Feedbacks
                    try {
                        let gitFbs = [];
                        if (githubService.isConfigured()) {
                            const { owner, repo } = githubService.getConfig();
                            const url = `https://api.github.com/repos/${owner}/${repo}/contents/src/data/feedbacks.json?t=${Date.now()}`;
                            const fbApiRes = await fetch(url, { headers: githubService.getHeaders(), cache: 'no-store' });
                            if (fbApiRes.ok) {
                                const fbFile = await fbApiRes.json();
                                gitFbs = JSON.parse(decodeURIComponent(escape(atob(fbFile.content))));
                            }
                        } else {
                            const fbRes = await fetch(`${FEEDBACKS_URL}?t=${Date.now()}`);
                            if (fbRes.ok) gitFbs = await fbRes.json();
                        }
                        allFbs = [...gitFbs];
                    } catch (e) { console.warn("Git FB fetch failed:", e); }

                    // B. Try Cloud Feedbacks
                    try {
                        const cloudFbs = await fetchCloudFeedbacks();
                        cloudFbs.forEach(cfb => {
                            // LINKING LOGIC: Match by title if itemId is missing
                            if (!cfb.itemId && cfb.title) {
                                const match = sanitizedData.find(i => i.title === cfb.title);
                                if (match) cfb.itemId = match.id;
                            }

                            // Avoid duplicates if already synced to git
                            const exists = allFbs.some(gf => gf.message === cfb.message && gf.timestamp === cfb.timestamp);
                            if (!exists) allFbs.push(cfb);
                        });
                    } catch (e) { console.warn("Cloud FB fetch failed:", e); }

                    // C. Sort and Update State
                    allFbs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    setFeedbacks(allFbs);
                };

                processFeedbacks();

            } catch (err) {
                console.warn("Critical data fetch failed:", err);
                setFetchError(err.message);
                setItems(bundledData);
                setFeedbacks(bundledFeedbacks);
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
