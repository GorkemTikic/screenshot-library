import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('owner metrics preserve catalog totals and render loaded remote zeros', async (context) => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [react()],
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });
  const { OwnerMetrics } = await server.ssrLoadModule('/src/pages/OwnersPage.jsx');
  const active = {
    guides: 3,
    lifetime: 5,
    views: 0,
    imageCopies: 0,
    responseCopies: 0,
    editedImageCopies: 0,
    interactions: 0,
  };
  let renderer;
  const values = () => renderer.root.findAllByType('strong').map((node) => node.children.join(''));

  context.after(async () => {
    if (renderer) await act(async () => renderer.unmount());
    await server.close();
  });

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(OwnerMetrics, { active, remoteReady: false }));
  });
  assert.deepEqual(values(), ['3', '5', '—', '—', '—', '—', '—']);

  await act(async () => {
    renderer.update(React.createElement(OwnerMetrics, { active, remoteReady: true }));
  });
  assert.deepEqual(values(), ['3', '5', '0', '0', '0', '0', '0']);
});
