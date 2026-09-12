import test from 'node:test';
import assert from 'node:assert/strict';

import { createContentApi, ContentApiError } from '../src/services/contentApi.js';

const storage = (token = '') => ({ getItem: () => token || null, setItem() {}, removeItem() {} });

test('public request creation is idempotent and never sends contributor authorization', async () => {
  const calls = [];
  const api = createContentApi({
    baseUrl: 'https://api.example.com', storage: storage('secret'), uuid: () => '12345678-1234-1234-1234-123456789012',
    fetchImpl: async (url, init) => { calls.push([url, init]); return new Response(JSON.stringify({ request: { id: 'REQ-1' } }), { status: 200 }); },
  });
  await api.createRequest({ description: 'Missing screenshot' });
  assert.equal(calls[0][0], 'https://api.example.com/requests');
  assert.equal(calls[0][1].headers.Authorization, undefined);
  assert.equal(calls[0][1].headers['Idempotency-Key'], '12345678-1234-1234-1234-123456789012');
});

test('request reads and mutations use the contributor session and versioned body', async () => {
  const calls = [];
  const api = createContentApi({
    baseUrl: 'https://api.example.com', storage: storage('secret'), uuid: () => '12345678-1234-1234-1234-123456789012',
    fetchImpl: async (url, init) => { calls.push([url, init]); return new Response(JSON.stringify({ ok: true }), { status: 200 }); },
  });
  await api.requests();
  await api.updateRequest('REQ 1', { baseVersion: 4, status: 'in_progress' });
  await api.importRequests();
  await api.resyncRequests();
  assert.equal(calls[0][1].headers.Authorization, 'Bearer secret');
  assert.equal(calls[1][0], 'https://api.example.com/requests/REQ%201');
  assert.equal(JSON.parse(calls[1][1].body).baseVersion, 4);
  assert.equal(calls[1][1].headers['Idempotency-Key'], '12345678-1234-1234-1234-123456789012');
  assert.deepEqual(calls.slice(2).map(([url]) => url), ['https://api.example.com/requests/import', 'https://api.example.com/requests/resync']);
});

test('request conflicts expose the latest shared record', async () => {
  const api = createContentApi({
    baseUrl: 'https://api.example.com', storage: storage('secret'),
    fetchImpl: async () => new Response(JSON.stringify({ error: 'Changed', code: 'REQUEST_CONFLICT', latest: { id: 'REQ-1', version: 6 } }), { status: 409 }),
  });
  await assert.rejects(() => api.updateRequest('REQ-1', { baseVersion: 5 }), (error) => {
    assert.ok(error instanceof ContentApiError);
    assert.equal(error.latest.version, 6);
    return true;
  });
});
