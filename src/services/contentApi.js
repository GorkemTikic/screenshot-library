export const SESSION_KEY = 'fdsl_session_v1';

export class ContentApiError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'ContentApiError';
        Object.assign(this, details);
    }
}

export function createContentApi({
    baseUrl = import.meta.env?.VITE_CONTENT_API_URL || '',
    storage = globalThis.sessionStorage,
    fetchImpl = globalThis.fetch,
    uuid = () => globalThis.crypto.randomUUID(),
} = {}) {
    const base = baseUrl.replace(/\/+$/, '');
    const token = () => storage?.getItem(SESSION_KEY) || '';

    const parseResponse = async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new ContentApiError(payload.error || `Request failed with status ${response.status}.`, {
                status: response.status,
                code: payload.code || 'API_ERROR',
                requestId: payload.requestId,
                conflicts: payload.conflicts,
                latest: payload.latest,
            });
        }
        return payload;
    };

    const request = async (path, { method = 'GET', body, auth = true, idempotency = false } = {}) => {
        if (!base) throw new ContentApiError('Content Studio API is not configured for this build.', { status: 0, code: 'API_UNAVAILABLE' });
        const headers = { Accept: 'application/json' };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (auth && token()) headers.Authorization = `Bearer ${token()}`;
        if (idempotency) headers['Idempotency-Key'] = uuid();
        return parseResponse(await fetchImpl(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
    };

    return {
        configured: Boolean(base),
        sessionToken: token,
        async login(code) {
            const result = await request('/auth/login', { method: 'POST', body: { code }, auth: false });
            storage?.setItem(SESSION_KEY, result.token);
            return result;
        },
        async logout() {
            try { if (token()) await request('/auth/logout', { method: 'POST' }); }
            finally { storage?.removeItem(SESSION_KEY); }
        },
        me: () => request('/auth/me'),
        content: () => request('/content'),
        contributors: () => request('/contributors'),
        audit: () => request('/audit'),
        requests: () => request('/requests'),
        requestAssignees: () => request('/request-assignees'),
        createRequest: (input) => request('/requests', { method: 'POST', body: input, auth: false, idempotency: true }),
        updateRequest: (id, input) => request(`/requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: input, idempotency: true }),
        importRequests: () => request('/requests/import', { method: 'POST', body: {}, idempotency: true }),
        resyncRequests: () => request('/requests/resync', { method: 'POST', body: {}, idempotency: true }),
        createContributor: (displayName, role = 'contributor') => request('/contributors', { method: 'POST', body: { displayName, role } }),
        updateContributor: (id, patch) => request(`/contributors/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
        rotateContributorCode: (id) => request(`/contributors/${encodeURIComponent(id)}/rotate-code`, { method: 'POST' }),
        async publish(payload, image = null, idempotencyKey = uuid()) {
            if (!base) throw new ContentApiError('Content Studio API is not configured for this build.', { status: 0, code: 'API_UNAVAILABLE' });
            const headers = new Headers({ Accept: 'application/json', Authorization: `Bearer ${token()}`, 'Idempotency-Key': idempotencyKey });
            let body;
            if (image) {
                body = new FormData();
                body.set('payload', JSON.stringify(payload));
                body.set('image', image);
            } else {
                headers.set('Content-Type', 'application/json');
                body = JSON.stringify(payload);
            }
            const method = payload.action === 'create' ? 'POST' : 'PATCH';
            return parseResponse(await fetchImpl(`${base}/content${payload.recordId ? `/${payload.recordId}` : ''}`, { method, headers, body }));
        },
    };
}

export const contentApi = createContentApi();
