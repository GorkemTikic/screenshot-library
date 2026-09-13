import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const item = (id) => ({
  id,
  image: `${id}.png`,
  title: `${id} screenshot`,
  topic: 'General',
  language: 'English',
  owner: 'CS Gorkem T',
});

const textContent = (node) => node.children.filter((child) => typeof child === 'string').join('');

test('rerendering for a new item aborts and clears a pending screenshot copy', async (context) => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [react()],
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });
  const { ScreenshotCopyButton } = await server.ssrLoadModule('/src/components/ScreenshotCopyButton.jsx');
  let renderer;
  let resolveOldCopy;
  let oldSignal;
  const reports = [];
  const copyScreenshotFn = (_url, options) => {
    oldSignal = options.signal;
    return new Promise((resolve) => { resolveOldCopy = resolve; });
  };
  const logEventFn = (...args) => reports.push(args);
  const renderButton = (currentItem) => React.createElement(ScreenshotCopyButton, {
    item: currentItem,
    source: 'card',
    copyScreenshotFn,
    logEventFn,
  });

  context.after(async () => {
    if (renderer) await act(async () => renderer.unmount());
    await server.close();
  });

  await act(async () => {
    renderer = TestRenderer.create(renderButton(item('old')));
  });
  let button = renderer.root.findByType('button');
  let pendingCopy;
  await act(async () => {
    pendingCopy = button.props.onClick();
    await Promise.resolve();
  });

  assert.equal(typeof resolveOldCopy, 'function', 'the injected copy operation should remain pending');
  assert.equal(button.props.disabled, true);

  await act(async () => {
    renderer.update(renderButton(item('new')));
  });

  assert.equal(oldSignal.aborted, true);
  button = renderer.root.findByType('button');
  assert.equal(button.props.disabled, false);
  assert.equal(textContent(button), 'Copy Screenshot');
  assert.equal(textContent(renderer.root.findByProps({ role: 'status' })), '');

  await act(async () => {
    renderer.update(renderButton(item('old')));
  });

  button = renderer.root.findByType('button');
  assert.equal(button.props.disabled, false);
  assert.equal(textContent(button), 'Copy Screenshot');
  assert.equal(textContent(renderer.root.findByProps({ role: 'status' })), '');

  await act(async () => {
    resolveOldCopy({ ok: true, method: 'clipboard' });
    await pendingCopy;
  });

  assert.equal(reports.length, 0);
  button = renderer.root.findByType('button');
  assert.equal(button.props.disabled, false);
  assert.equal(textContent(button), 'Copy Screenshot');
  assert.equal(textContent(renderer.root.findByProps({ role: 'status' })), '');
});
