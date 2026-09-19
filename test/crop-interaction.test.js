import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginCropGesture, cropOperationChangesCrop, cropOperationForPoint, cropTargetAtPoint, gestureMovedEnough,
} from '../src/domain/cropInteraction.js';

const crop = { x: 0.2, y: 0.25, width: 0.5, height: 0.4 };
const tolerance = { x: 0.03, y: 0.04 };

test('crop hit testing prioritizes corner handles over the crop interior', () => {
  assert.deepEqual(cropTargetAtPoint(crop, { x: 0.21, y: 0.26 }, tolerance), { kind: 'resize', corner: 'nw' });
  assert.deepEqual(cropTargetAtPoint(crop, { x: 0.69, y: 0.26 }, tolerance), { kind: 'resize', corner: 'ne' });
  assert.deepEqual(cropTargetAtPoint(crop, { x: 0.21, y: 0.64 }, tolerance), { kind: 'resize', corner: 'sw' });
  assert.deepEqual(cropTargetAtPoint(crop, { x: 0.69, y: 0.64 }, tolerance), { kind: 'resize', corner: 'se' });
  assert.deepEqual(cropTargetAtPoint(crop, { x: 0.45, y: 0.45 }, tolerance), { kind: 'move' });
  assert.deepEqual(cropTargetAtPoint(crop, { x: 0.05, y: 0.05 }, tolerance), { kind: 'create' });
});

test('resizing a crop keeps the opposite corner anchored and clamps the pointer', () => {
  const gesture = beginCropGesture(crop, { x: 0.2, y: 0.25 }, tolerance);
  assert.deepEqual(cropOperationForPoint(gesture, { x: -0.2, y: 1.4 }), {
    type: 'crop',
    start: { x: 0.7, y: 0.65 },
    end: { x: 0, y: 1 },
  });
});

test('moving a crop preserves its size and clamps the whole crop inside the image', () => {
  const gesture = beginCropGesture(crop, { x: 0.4, y: 0.4 }, tolerance);
  assert.deepEqual(cropOperationForPoint(gesture, { x: 0.95, y: 0.95 }), {
    type: 'crop',
    start: { x: 0.5, y: 0.6 },
    end: { x: 1, y: 1 },
  });
});

test('dragging outside an existing crop creates a replacement crop', () => {
  const gesture = beginCropGesture(crop, { x: 0.05, y: 0.1 }, tolerance);
  assert.deepEqual(cropOperationForPoint(gesture, { x: 0.6, y: 0.8 }), {
    type: 'crop',
    start: { x: 0.05, y: 0.1 },
    end: { x: 0.6, y: 0.8 },
  });
});

test('gesture movement uses display pixels and crop no-op comparison ignores direction', () => {
  assert.equal(gestureMovedEnough({ x: 10, y: 10 }, { x: 12, y: 12 }), false);
  assert.equal(gestureMovedEnough({ x: 10, y: 10 }, { x: 14, y: 10 }), true);
  assert.equal(cropOperationChangesCrop(crop, {
    type: 'crop', start: { x: 0.7, y: 0.65 }, end: { x: 0.2, y: 0.25 },
  }), false);
  assert.equal(cropOperationChangesCrop(crop, {
    type: 'crop', start: { x: 0.25, y: 0.25 }, end: { x: 0.7, y: 0.65 },
  }), true);
});
