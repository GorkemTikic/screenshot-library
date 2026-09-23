import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TOOL_LABELS = ['Crop', 'Arrow', 'Number', 'Highlight', 'Blur'];
const session = (activeTool = null, crop = null) => ({
  crop, operations: [], past: crop ? [{ crop: null, operations: [] }] : [], future: [], activeTool, nextId: 2,
});

test('editor owns one pointer, rejects tiny/no-op gestures, cancels Escape, and reloads images safely', async (context) => {
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
  const frames = new Map();
  const cancelledFrames = [];
  let nextFrame = 1;
  const original = {
    Image: globalThis.Image,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    devicePixelRatio: globalThis.devicePixelRatio,
  };
  globalThis.devicePixelRatio = 3;
  globalThis.requestAnimationFrame = (callback) => { const id = nextFrame++; frames.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = (id) => { cancelledFrames.push(id); frames.delete(id); };
  globalThis.Image = class ImageMock {
    constructor() {
      this.naturalWidth = 2000;
      this.naturalHeight = 1000;
      images.push(this);
    }
  };

  const context2d = {
    clearRect() {}, drawImage() {}, save() {}, restore() {}, fillRect() {}, strokeRect() {}, setLineDash() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, closePath() {}, fill() {}, arc() {}, rect() {}, clip() {}, fillText() {},
  };
  const captures = [];
  const releases = [];
  const canvas = {
    width: 0, height: 0, style: {},
    getContext: () => context2d,
    getBoundingClientRect: () => ({
      left: 0, top: 0,
      width: Number.parseFloat(canvas.style.width) || 600,
      height: Number.parseFloat(canvas.style.height) || 300,
    }),
    setPointerCapture: (id) => captures.push(id),
    releasePointerCapture: (id) => releases.push(id),
  };
  const stage = { getBoundingClientRect: () => ({ width: 600, height: 400 }) };
  const createNodeMock = (element) => {
    if (element.type === 'canvas') return canvas;
    if (element.props.className === 'markup-stage') return stage;
    return {};
  };
  const flushFrames = async () => act(async () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(16));
  });
  const readyValues = [];
  const onImageReady = (value) => readyValues.push(value);
  const actions = [];
  let renderer;
  const render = (imageUrl, currentSession) => React.createElement(QuickMarkupEditor, {
    imageUrl, session: currentSession, dispatch: (action) => actions.push(action), onImageReady,
  });

  context.after(async () => {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.Image = original.Image;
    globalThis.requestAnimationFrame = original.requestAnimationFrame;
    globalThis.cancelAnimationFrame = original.cancelAnimationFrame;
    globalThis.devicePixelRatio = original.devicePixelRatio;
    await server.close();
  });

  await act(async () => {
    renderer = TestRenderer.create(render('/a.png', session('arrow')), { createNodeMock });
  });
  for (const label of TOOL_LABELS) assert.equal(renderer.root.findByProps({ 'aria-label': label }).props.disabled, true);
  await act(async () => images[0].onload());
  await flushFrames();
  assert.deepEqual({ width: canvas.width, height: canvas.height }, { width: 1200, height: 600 });
  assert.deepEqual(canvas.style, { width: '600px', height: '300px' });

  let markupCanvas = renderer.root.findByProps({ 'aria-label': 'Screenshot markup canvas' });
  await act(async () => {
    markupCanvas.props.onPointerDown({ pointerId: 7, clientX: 60, clientY: 60, currentTarget: canvas });
    markupCanvas.props.onPointerUp({ pointerId: 7, clientX: 62, clientY: 62, currentTarget: canvas });
  });
  assert.equal(actions.length, 0, 'near-zero drags do not create annotations');

  markupCanvas = renderer.root.findByProps({ 'aria-label': 'Screenshot markup canvas' });
  await act(async () => markupCanvas.props.onPointerDown({ pointerId: 8, clientX: 60, clientY: 60, currentTarget: canvas }));
  markupCanvas.props.onPointerMove({ pointerId: 8, clientX: 140, clientY: 100, currentTarget: canvas });
  markupCanvas.props.onPointerMove({ pointerId: 8, clientX: 220, clientY: 140, currentTarget: canvas });
  assert.equal(frames.size, 1, 'rapid pointer previews share one animation frame');
  markupCanvas.props.onPointerMove({ pointerId: 9, clientX: 300, clientY: 180, currentTarget: canvas });
  markupCanvas.props.onPointerCancel({ pointerId: 9, currentTarget: canvas });
  markupCanvas.props.onPointerUp({ pointerId: 9, clientX: 300, clientY: 180, currentTarget: canvas });
  assert.equal(actions.length, 0, 'unrelated pointers cannot move or complete the gesture');
  await act(async () => markupCanvas.props.onPointerUp({ pointerId: 8, clientX: 300, clientY: 180, currentTarget: canvas }));
  assert.equal(actions.length, 1);
  assert.deepEqual(releases, [7, 8]);

  actions.length = 0;
  markupCanvas = renderer.root.findByProps({ 'aria-label': 'Screenshot markup canvas' });
  await act(async () => markupCanvas.props.onPointerDown({ pointerId: 10, clientX: 80, clientY: 80, currentTarget: canvas }));
  const editor = renderer.root.findByProps({ className: 'markup-editor' });
  await act(async () => editor.props.onKeyDown({
    key: 'Escape', preventDefault() {}, stopPropagation() {},
  }));
  await act(async () => markupCanvas.props.onPointerUp({ pointerId: 10, clientX: 350, clientY: 200, currentTarget: canvas }));
  assert.equal(actions.length, 0, 'Escape discards the in-flight annotation');
  assert.equal(releases.at(-1), 10);

  await act(async () => renderer.update(render('/a.png', session('crop', { x: 0, y: 0.2, width: 0.5, height: 0.5 }))));
  markupCanvas = renderer.root.findByProps({ 'aria-label': 'Screenshot markup canvas' });
  await act(async () => markupCanvas.props.onPointerDown({ pointerId: 11, clientX: 120, clientY: 120, currentTarget: canvas }));
  await act(async () => markupCanvas.props.onPointerUp({ pointerId: 11, clientX: 50, clientY: 120, currentTarget: canvas }));
  assert.equal(actions.length, 0, 'a clamped no-op crop move does not add history');

  await act(async () => renderer.update(render('/pending.png', session('arrow'))));
  const staleLoad = images[1].onload;
  await act(async () => renderer.update(render('/b.png', session('arrow'))));
  for (const label of TOOL_LABELS) assert.equal(renderer.root.findByProps({ 'aria-label': label }).props.disabled, true);
  assert.equal(readyValues.at(-1), null, 'a URL change clears the copy-ready image immediately');
  await act(async () => staleLoad());
  for (const label of TOOL_LABELS) assert.equal(renderer.root.findByProps({ 'aria-label': label }).props.disabled, true);
  assert.equal(readyValues.at(-1), null, 'a stale load callback cannot restore the old image');

  await act(async () => images[2].onerror());
  assert.equal(renderer.root.findByProps({ className: 'markup-error-message' }).children.join(''), 'This screenshot cannot be prepared for markup.');
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Retry screenshot' }).props.onClick());
  await act(async () => images[3].onload());
  await flushFrames();
  assert.equal(renderer.root.findAllByProps({ role: 'alert' }).length, 0);
  for (const label of TOOL_LABELS) assert.equal(renderer.root.findByProps({ 'aria-label': label }).props.disabled, false);
  assert.equal(readyValues.at(-1), images[3]);
  assert.ok(cancelledFrames.length > 0, 'pending preview frames are cancelled across URL sessions');
  assert.deepEqual(captures, [7, 8, 10, 11]);
});
