import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const RequestModalContext = createContext(null);

export function RequestModalProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);
    const [prefillSearch, setPrefillSearch] = useState('');

    const open = useCallback((options = {}) => {
        setPrefillSearch(options.prefillSearch || '');
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setPrefillSearch('');
    }, []);

    const value = useMemo(() => ({ isOpen, prefillSearch, open, close }), [isOpen, prefillSearch, open, close]);

    return (
        <RequestModalContext.Provider value={value}>
            {children}
        </RequestModalContext.Provider>
    );
}

export function useRequestModal() {
    const ctx = useContext(RequestModalContext);
    if (!ctx) throw new Error('useRequestModal must be used within RequestModalProvider');
    return ctx;
}
