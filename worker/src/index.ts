import { authenticate, login, logout } from './auth';
import { allowedOrigin, ApiError, corsHeaders, json } from './http';
import type { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = request.headers.get('X-Request-Id') || crypto.randomUUID();
    const origin = allowedOrigin(request.headers.get('Origin'), env.ALLOWED_ORIGINS);
    if (request.method === 'OPTIONS') return new Response(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) });
    if (request.headers.get('Origin') && !origin) return json({ error: 'Origin is not allowed.', code: 'ORIGIN_DENIED' }, 403, requestId, null);

    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'fd-screenshot-library-api' }, 200, requestId, origin);
      if (request.method === 'POST' && url.pathname === '/auth/login') {
        const input = await request.json<{ code?: string }>();
        if (!input.code) throw new ApiError(400, 'Access code is required.', 'CODE_REQUIRED');
        return json(await login(env, input.code), 200, requestId, origin);
      }
      if (request.method === 'POST' && url.pathname === '/auth/logout') {
        await logout(request, env);
        return json({ ok: true }, 200, requestId, origin);
      }
      if (request.method === 'GET' && url.pathname === '/auth/me') {
        const principal = await authenticate(request, env);
        return json({ principal }, 200, requestId, origin);
      }
      return json({ error: 'Route not found.', code: 'NOT_FOUND' }, 404, requestId, origin);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message, code: error.code }, error.status, requestId, origin);
      console.error(requestId, error);
      return json({ error: 'Unexpected server error.', code: 'INTERNAL_ERROR' }, 500, requestId, origin);
    }
  },
};
