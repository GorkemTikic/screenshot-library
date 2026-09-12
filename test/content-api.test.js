import test from 'node:test';
import assert from 'node:assert/strict';

import { ContentApiError, createContentApi } from '../src/services/contentApi.js';

function storage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test('content client trims base URL and persists login session', async () => {
    const calls = [];
    const sessionStorage = storage();
    const api = createContentApi({
        baseUrl: 'https://api.example.com/',
        storage: sessionStorage,
        fetchImpl: async (url, init) => {
            calls.push([url, init]);
            return new Response(JSON.stringify({ token: 'session-token', principal: { id: '1', role: 'contributor' } }), { headers: { 'content-type': 'application/json' } });
        },
    });
    await api.login('fdsl_code');
    assert.equal(calls[0][0], 'https://api.example.com/auth/login');
    assert.equal(sessionStorage.getItem('fdsl_session_v1'), 'session-token');
});

test('authenticated requests and publishes include session and idempotency headers', async () => {
    const calls = [];
    const api = createContentApi({
        baseUrl: 'https://api.example.com',
        storage: storage({ fdsl_session_v1: 'saved-token' }),
        uuid: () => '12345678-1234-1234-1234-123456789012',
        fetchImpl: async (url, init) => {
            calls.push([url, init]);
            return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
        },
    });
    await api.me();
    await api.publish({ action: 'update', recordId: 1, patch: { title: 'New' } });
    assert.equal(calls[0][1].headers.Authorization, 'Bearer saved-token');
    assert.equal(calls[1][1].headers.get('Idempotency-Key'), '12345678-1234-1234-1234-123456789012');
});

test('409 responses become structured ContentApiError conflicts', async () => {
    const api = createContentApi({
        baseUrl: 'https://api.example.com',
        storage: storage({ fdsl_session_v1: 'saved-token' }),
        fetchImpl: async () => new Response(JSON.stringify({ code: 'EDIT_CONFLICT', error: 'Conflict', conflicts: { title: { base: 'A', latest: 'B', mine: 'C' } }, latest: { id: 1 } }), { status: 409, headers: { 'content-type': 'application/json' } }),
    });
    await assert.rejects(() => api.publish({ action: 'update', recordId: 1, patch: { title: 'C' } }), (error) => {
        assert.ok(error instanceof ContentApiError);
        assert.equal(error.status, 409);
        assert.equal(error.conflicts.title.latest, 'B');
        return true;
    });
});
