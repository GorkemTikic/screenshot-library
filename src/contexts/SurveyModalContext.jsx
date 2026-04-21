import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const SurveyModalContext = createContext(null);

export function SurveyModalProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);

    const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

    return (
        <SurveyModalContext.Provider value={value}>
            {children}
        </SurveyModalContext.Provider>
    );
}

export function useSurveyModal() {
    const ctx = useContext(SurveyModalContext);
    if (!ctx) throw new Error('useSurveyModal must be used within SurveyModalProvider');
    return ctx;
}
