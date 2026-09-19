import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarkupSession, isMarkupDirty, markupReducer, markupToolsUsed, nextMarkerNumber } from '../src/domain/markup.js';

const drag = (type, start = { x: 0.1, y: 0.2 }, end = { x: 0.8, y: 0.7 }) => ({ type, start, end });

test('a new markup session is clean', () => {
  const state = createMarkupSession();
  assert.equal(isMarkupDirty(state), false);
  assert.deepEqual(markupToolsUsed(state), []);
  assert.equal(nextMarkerNumber(state), 1);
});

test('committing annotations clamps coordinates and records history', () => {
  const state = markupReducer(createMarkupSession(), {
    type: 'commit', operation: drag('arrow', { x: -1, y: 0.2 }, { x: 2, y: 0.7 }),
  });
  assert.deepEqual(state.operations[0], {
    id: 'markup-1', type: 'arrow', start: { x: 0, y: 0.2 }, end: { x: 1, y: 0.7 },
  });
  assert.equal(state.past.length, 1);
  assert.equal(isMarkupDirty(state), true);
});

test('crop replaces the prior crop and remains undoable', () => {
  const first = markupReducer(createMarkupSession(), { type: 'commit', operation: drag('crop') });
  const second = markupReducer(first, {
    type: 'commit', operation: drag('crop', { x: 0.25, y: 0.25 }, { x: 0.75, y: 0.8 }),
  });
  assert.deepEqual(second.crop, { x: 0.25, y: 0.25, width: 0.5, height: 0.55 });
  assert.deepEqual(markupReducer(second, { type: 'undo' }).crop, { x: 0.1, y: 0.2, width: 0.7, height: 0.5 });
});

test('a zero-size crop at the lower-right edge expands inward', () => {
  const state = markupReducer(createMarkupSession(), {
    type: 'commit', operation: drag('crop', { x: 1, y: 1 }, { x: 1, y: 1 }),
  });
  assert.deepEqual(state.crop, { x: 0.999, y: 0.999, width: 0.001, height: 0.001 });
});

test('a near-edge crop keeps its minimum rectangle inside normalized bounds', () => {
  const state = markupReducer(createMarkupSession(), {
    type: 'commit', operation: drag('crop', { x: 0.9998, y: 0.9996 }, { x: 1, y: 1 }),
  });
  assert.deepEqual(state.crop, { x: 0.999, y: 0.999, width: 0.001, height: 0.001 });
  assert.ok(state.crop.x + state.crop.width <= 1);
  assert.ok(state.crop.y + state.crop.height <= 1);
});

test('undo, redo, and branching preserve deterministic history', () => {
  const arrow = markupReducer(createMarkupSession(), { type: 'commit', operation: drag('arrow') });
  const highlighted = markupReducer(arrow, { type: 'commit', operation: drag('highlight') });
  const undone = markupReducer(highlighted, { type: 'undo' });
  assert.equal(undone.operations.length, 1);
  assert.equal(markupReducer(undone, { type: 'redo' }).operations.length, 2);
  const branched = markupReducer(undone, { type: 'commit', operation: drag('blur') });
  assert.equal(branched.future.length, 0);
  assert.deepEqual(markupToolsUsed(branched), ['arrow', 'blur']);
});

test('number markers reuse the next visible sequence after undo and reset', () => {
  const one = markupReducer(createMarkupSession(), { type: 'commit', operation: { type: 'number', point: { x: 0.2, y: 0.3 } } });
  const two = markupReducer(one, { type: 'commit', operation: { type: 'number', point: { x: 0.4, y: 0.5 } } });
  assert.deepEqual(two.operations.map((item) => item.number), [1, 2]);
  assert.equal(nextMarkerNumber(markupReducer(two, { type: 'undo' })), 2);
  assert.equal(nextMarkerNumber(markupReducer(two, { type: 'reset' })), 1);
});

test('reset clears markup history instead of leaving the cleared session undoable', () => {
  const arrow = markupReducer(createMarkupSession(), { type: 'commit', operation: drag('arrow') });
  const highlighted = markupReducer(arrow, { type: 'commit', operation: drag('highlight') });
  const reset = markupReducer(highlighted, { type: 'reset' });

  assert.equal(isMarkupDirty(reset), false);
  assert.deepEqual(reset.past, []);
  assert.deepEqual(reset.future, []);
  assert.equal(markupReducer(reset, { type: 'undo' }), reset);
});

test('tool selection rejects unsupported tools and permits null deselection', () => {
  const selected = markupReducer(createMarkupSession(), { type: 'select-tool', tool: 'arrow' });
  const unsupported = markupReducer(selected, { type: 'select-tool', tool: 'eraser' });
  assert.equal(unsupported, selected);
  assert.equal(unsupported.activeTool, 'arrow');
  assert.equal(markupReducer(unsupported, { type: 'select-tool', tool: null }).activeTool, null);
});
