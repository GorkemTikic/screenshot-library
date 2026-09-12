import { authenticate, login, logout, requireOwner } from './auth';
import { createContributor, listAudit, listContributors, listRequestAssignees, rotateContributorCode, updateContributor } from './contributors';
import { sha256 } from './crypto';
import { allowedOrigin, ApiError, corsHeaders, json } from './http';
import { listWorkflowRequests } from './request-writer';
import type { Env } from './types';

export { CatalogWriter } from './publisher';
export { RequestWriter } from './request-writer';

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
      if (request.method === 'GET' && url.pathname === '/content') {
        await authenticate(request, env);
        const { readRepoState } = await import('./github');
        const state = await readRepoState(env);
        return json({ items: state.items, version: state.commitSha }, 200, requestId, origin);
      }
      if (request.method === 'GET' && url.pathname === '/requests') {
        await authenticate(request, env);
        return json({ requests: await listWorkflowRequests(env) }, 200, requestId, origin);
      }
      if (request.method === 'GET' && url.pathname === '/request-assignees') {
        await authenticate(request, env);
        return json(await listRequestAssignees(env), 200, requestId, origin);
      }
      const requestMutation = (request.method === 'POST' && ['/requests', '/requests/import', '/requests/resync'].includes(url.pathname))
        || (request.method === 'PATCH' && /^\/requests\/[^/]+$/.test(url.pathname));
      if (requestMutation) {
        const publicCreate = request.method === 'POST' && url.pathname === '/requests';
        const principal = publicCreate ? null : await authenticate(request, env);
        if (principal && ['/requests/import', '/requests/resync'].includes(url.pathname)) requireOwner(principal);
        const body = await request.arrayBuffer();
        const headers = new Headers(request.headers);
        headers.set('X-Request-Id', requestId);
        if (principal) headers.set('X-FDSL-Principal', JSON.stringify(principal));
        else {
          const identity = `${request.headers.get('CF-Connecting-IP') || 'local'}|${request.headers.get('User-Agent') || ''}|${env.SESSION_SECRET}`;
          headers.set('X-FDSL-Public-Hash', await sha256(identity));
        }
        const writerId = env.REQUEST_WRITER.idFromName('request-writer');
        const response = await env.REQUEST_WRITER.get(writerId).fetch(new Request(`https://writer${url.pathname}`, { method: request.method, headers, body }));
        const responseHeaders = corsHeaders(origin);
        response.headers.forEach((value, key) => responseHeaders.set(key, value));
        return new Response(response.body, { status: response.status, headers: responseHeaders });
      }
      if (url.pathname === '/contributors' && request.method === 'GET') {
        const principal = await authenticate(request, env); requireOwner(principal);
        return json(await listContributors(env), 200, requestId, origin);
      }
      if (url.pathname === '/contributors' && request.method === 'POST') {
        const principal = await authenticate(request, env); requireOwner(principal);
        return json(await createContributor(env, await request.json()), 201, requestId, origin);
      }
      const contributorMatch = /^\/contributors\/([^/]+)$/.exec(url.pathname);
      if (contributorMatch && request.method === 'PATCH') {
        const principal = await authenticate(request, env); requireOwner(principal);
        return json(await updateContributor(env, principal, decodeURIComponent(contributorMatch[1]!), await request.json<Record<string, unknown>>()), 200, requestId, origin);
      }
      const rotateMatch = /^\/contributors\/([^/]+)\/rotate-code$/.exec(url.pathname);
      if (rotateMatch && request.method === 'POST') {
        const principal = await authenticate(request, env); requireOwner(principal);
        return json(await rotateContributorCode(env, decodeURIComponent(rotateMatch[1]!)), 200, requestId, origin);
      }
      if (url.pathname === '/audit' && request.method === 'GET') {
        const principal = await authenticate(request, env); requireOwner(principal);
        return json(await listAudit(env, Number(url.searchParams.get('limit')) || 100), 200, requestId, origin);
      }
      if (['POST', 'PATCH'].includes(request.method) && url.pathname.startsWith('/content')) {
        const principal = await authenticate(request, env);
        const body = await request.arrayBuffer();
        const headers = new Headers(request.headers);
        headers.set('X-FDSL-Principal', JSON.stringify(principal));
        headers.set('X-Request-Id', requestId);
        const writerId = env.CATALOG_WRITER.idFromName('repository-writer');
        const response = await env.CATALOG_WRITER.get(writerId).fetch(new Request(`https://writer${url.pathname}`, { method: request.method, headers, body }));
        const responseHeaders = corsHeaders(origin);
        response.headers.forEach((value, key) => responseHeaders.set(key, value));
        return new Response(response.body, { status: response.status, headers: responseHeaders });
      }
      return json({ error: 'Route not found.', code: 'NOT_FOUND' }, 404, requestId, origin);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message, code: error.code }, error.status, requestId, origin);
      console.error(requestId, error);
      return json({ error: 'Unexpected server error.', code: 'INTERNAL_ERROR' }, 500, requestId, origin);
    }
  },
};
