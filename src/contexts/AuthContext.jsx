/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { contentApi } from '../services/contentApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [state, setState] = useState(() => ({ status: contentApi.sessionToken() ? 'loading' : 'guest', principal: null, error: '' }));

    useEffect(() => {
        if (!contentApi.sessionToken()) return;
        let alive = true;
        contentApi.me()
            .then(({ principal }) => alive && setState({ status: 'authenticated', principal, error: '' }))
            .catch(() => {
                try { sessionStorage.removeItem('fdsl_session_v1'); } catch { /* private browsing */ }
                if (alive) setState({ status: 'guest', principal: null, error: '' });
            });
        return () => { alive = false; };
    }, []);

    const value = useMemo(() => ({
        ...state,
        apiAvailable: contentApi.configured,
        isOwner: state.principal?.role === 'owner',
        async login(code) {
            setState((current) => ({ ...current, status: 'loading', error: '' }));
            try {
                const result = await contentApi.login(code);
                setState({ status: 'authenticated', principal: result.principal, error: '' });
                return result;
            } catch (error) {
                setState({ status: 'guest', principal: null, error: error.message });
                throw error;
            }
        },
        async logout() {
            await contentApi.logout();
            setState({ status: 'guest', principal: null, error: '' });
        },
    }), [state]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const value = useContext(AuthContext);
    if (!value) throw new Error('useAuth must be used inside AuthProvider.');
    return value;
}
