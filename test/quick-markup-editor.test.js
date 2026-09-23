import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TOOL_LABELS = ['Crop', 'Arrow', 'Number', 'Highlight', 'Blur'];
const cleanSession = () => ({
  crop: null, operations: [], past: [], future: [], activeTool: null, nextId: 1,
});

test('markup tools require a decoded image and crop movement commits once on pointer up', async (context) => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [react()],
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });
  const { QuickMarkupEditor } = await server.ssrLoadModule('/src/components/QuickMarkupEditor.jsx');
  const images = [];
  const OriginalImage = globalThis.Image;
  globalThis.Image = class ImageMock {
    constructor() {
      this.naturalWidth = 1000;
      this.naturalHeight = 500;
      images.push(this);
    }
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      clearRect() {}, drawImage() {}, save() {}, restore() {}, fillRect() {}, strokeRect() {}, setLineDash() {},
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    setPointerCapture() {},
  };
  const createNodeMock = (element) => element.type === 'canvas' ? canvas : {};
  let renderer;

  context.after(async () => {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.Image = OriginalImage;
    await server.close();
  });

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(QuickMarkupEditor, {
      imageUrl: '/broken.png', session: cleanSession(), dispatch() {}, onImageReady() {},
    }), { createNodeMock });
  });
  assert.equal(renderer.root.findByProps({ 'aria-label': 'Loading screenshot' }).props.role, 'status');
  assert.equal(renderer.root.findByProps({ className: 'markup-preview' }).props.src, '/broken.png');
  for (const label of TOOL_LABELS) assert.equal(renderer.root.findByProps({ 'aria-label': label }).props.disabled, true);
  await act(async () => images[0].onerror());
  assert.equal(renderer.root.findByProps({ className: 'markup-error-message' }).children.join(''), 'This screenshot cannot be prepared for markup.');
  for (const label of TOOL_LABELS) assert.equal(renderer.root.findByProps({ 'aria-label': label }).props.disabled, true);

  await act(async () => renderer.root.findByProps({ 'aria-label': 'Retry screenshot' }).props.onClick());
  assert.equal(images.length, 2);
  assert.equal(renderer.root.findAllByProps({ role: 'alert' }).length, 0);
  await act(async () => images[1].onload());
  for (const label of TOOL_LABELS) assert.equal(renderer.root.findByProps({ 'aria-label': label }).props.disabled, false);

  await act(async () => renderer.unmount());
  const actions = [];
  const session = { ...cleanSession(), activeTool: 'crop', crop: { x: 0.2, y: 0.2, width: 0.5, height: 0.5 } };
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(QuickMarkupEditor, {
      imageUrl: '/ready.png', session, dispatch: (action) => actions.push(action), onImageReady() {},
    }), { createNodeMock });
  });
  for (const label of TOOL_LABELS) assert.equal(renderer.root.findByProps({ 'aria-label': label }).props.disabled, true);
  await act(async () => images[2].onload());
  for (const label of TOOL_LABELS) assert.equal(renderer.root.findByProps({ 'aria-label': label }).props.disabled, false);

  let markupCanvas = renderer.root.findByProps({ 'aria-label': 'Screenshot markup canvas' });
  await act(async () => markupCanvas.props.onPointerDown({
    pointerId: 1, clientX: 40, clientY: 40, currentTarget: canvas,
  }));
  markupCanvas = renderer.root.findByProps({ 'aria-label': 'Screenshot markup canvas' });
  await act(async () => markupCanvas.props.onPointerMove({ pointerId: 1, clientX: 60, clientY: 60, currentTarget: canvas }));
  assert.equal(actions.length, 0, 'crop previews do not create reducer history entries');
  markupCanvas = renderer.root.findByProps({ 'aria-label': 'Screenshot markup canvas' });
  await act(async () => markupCanvas.props.onPointerUp({ pointerId: 1, clientX: 60, clientY: 60, currentTarget: canvas }));
  assert.deepEqual(actions, [{
    type: 'commit',
    operation: { type: 'crop', start: { x: 0.4, y: 0.4 }, end: { x: 0.9, y: 0.9 } },
  }]);
});
