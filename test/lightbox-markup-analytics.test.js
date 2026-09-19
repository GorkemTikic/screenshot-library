import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const item = (id) => ({
  id, image: `${id}.png`, title: `Screenshot ${id}`, topic: 'General', language: 'English', owner: 'CS Gorkem T', text: 'Reply',
});

test('Lightbox emits markup_opened once per keyed inspector session', async (context) => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [react()], server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent',
  });
  const { Lightbox } = await server.ssrLoadModule('/src/components/Lightbox.jsx');
  const original = { Image: globalThis.Image, document: globalThis.document, window: globalThis.window };
  const images = [];
  globalThis.Image = class ImageMock {
    constructor() { this.naturalWidth = 1000; this.naturalHeight = 500; images.push(this); }
  };
  globalThis.document = { activeElement: { focus() {} } };
  globalThis.window = {
    addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, confirm: () => true,
  };
  const canvas = {
    width: 0, height: 0, style: {},
    getContext: () => ({
      clearRect() {}, drawImage() {}, save() {}, restore() {}, fillRect() {}, strokeRect() {}, setLineDash() {},
      beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, closePath() {}, fill() {}, arc() {}, rect() {}, clip() {}, fillText() {},
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 250 }),
    setPointerCapture() {}, releasePointerCapture() {},
  };
  const stage = { getBoundingClientRect: () => ({ width: 500, height: 300 }) };
  const createNodeMock = (element) => {
    if (element.type === 'canvas') return canvas;
    if (element.props.className === 'markup-stage') return stage;
    return { focus() {} };
  };
  const events = [];
  const logEventFn = (...args) => events.push(args);
  let renderer;
  const render = (record) => React.createElement(Lightbox, {
    key: record.id, item: record, position: 0, total: 1, onClose() {}, onNavigate() {}, markupLogEventFn: logEventFn,
  });
  const annotate = async (imageIndex, { load = true, select = true } = {}) => {
    if (load) await act(async () => images[imageIndex].onload());
    if (select) {
      const arrow = renderer.root.findByProps({ 'aria-label': 'Arrow' });
      await act(async () => arrow.props.onClick());
    }
    let markupCanvas = renderer.root.findByProps({ 'aria-label': 'Screenshot markup canvas' });
    await act(async () => markupCanvas.props.onPointerDown({ pointerId: 1, clientX: 50, clientY: 50, currentTarget: canvas }));
    markupCanvas = renderer.root.findByProps({ 'aria-label': 'Screenshot markup canvas' });
    await act(async () => markupCanvas.props.onPointerUp({ pointerId: 1, clientX: 300, clientY: 180, currentTarget: canvas }));
  };

  context.after(async () => {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.Image = original.Image;
    globalThis.document = original.document;
    globalThis.window = original.window;
    await server.close();
  });

  await act(async () => { renderer = TestRenderer.create(render(item('one')), { createNodeMock }); });
  await annotate(0);
  assert.equal(events.filter(([name]) => name === 'markup_opened').length, 1);
  await annotate(0, { load: false, select: false });
  assert.equal(events.filter(([name]) => name === 'markup_opened').length, 1);

  await act(async () => renderer.update(render(item('two'))));
  await annotate(1);
  assert.equal(events.filter(([name]) => name === 'markup_opened').length, 2);
});
