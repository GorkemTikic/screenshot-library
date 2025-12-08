import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import rawData from '../data/data.json';

const DataContext = createContext();

export function DataProvider({ children }) {
    const [items, setItems] = useState([]);
    const [favorites, setFavorites] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('fd_favorites')) || [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        setItems(rawData);
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
