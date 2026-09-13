import test from 'node:test';
import assert from 'node:assert/strict';
import { outputGeometry, sourcePoint, sourceRectangle } from '../src/utils/markupRenderer.js';

test('full output keeps intrinsic dimensions', () => {
  assert.deepEqual(outputGeometry(1920, 1080, null), { x: 0, y: 0, width: 1920, height: 1080 });
});

test('crop maps normalized coordinates to source pixels', () => {
  assert.deepEqual(outputGeometry(2000, 1000, { x: 0.25, y: 0.1, width: 0.5, height: 0.7 }), { x: 500, y: 100, width: 1000, height: 700 });
});

test('crop derives its span from rounded endpoints on odd intrinsic dimensions', () => {
  assert.deepEqual(outputGeometry(1507, 901, { x: 0.5, y: 0, width: 0.5, height: 1 }), {
    x: 754,
    y: 0,
    width: 753,
    height: 901,
  });
});

test('minimum crop at the bottom-right stays inside the source', () => {
  const geometry = outputGeometry(500, 300, { x: 0.999, y: 0.999, width: 0.001, height: 0.001 });
  assert.deepEqual(geometry, { x: 499, y: 299, width: 1, height: 1 });
  assert.ok(geometry.x + geometry.width <= 500);
  assert.ok(geometry.y + geometry.height <= 300);
});

test('points and rectangles map to source pixels', () => {
  assert.deepEqual(sourcePoint({ x: 0.5, y: 0.25 }, 1200, 800), { x: 600, y: 200 });
  assert.deepEqual(sourceRectangle({ start: { x: 0.1, y: 0.2 }, end: { x: 0.6, y: 0.8 } }, 1000, 500), { x: 100, y: 100, width: 500, height: 300 });
});
