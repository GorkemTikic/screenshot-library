const TOOLS = new Set(['crop', 'arrow', 'number', 'highlight', 'blur']);
const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const point = (value = {}) => ({ x: clamp(value.x), y: clamp(value.y) });
const snapshot = (state) => ({ crop: state.crop, operations: state.operations });

function rectangle(start, end) {
  const span = (from, to) => Math.max(0.001, Number(Math.abs(to - from).toFixed(6)));
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: span(start.x, end.x),
    height: span(start.y, end.y),
  };
}

export const createMarkupSession = () => ({
  crop: null, operations: [], past: [], future: [], activeTool: null, nextId: 1,
});

export const isMarkupDirty = (state) => Boolean(state.crop || state.operations.length);

export const markupToolsUsed = (state) => [
  ...(state.crop ? ['crop'] : []),
  ...new Set(state.operations.map((operation) => operation.type)),
];

export const nextMarkerNumber = (state) => state.operations
  .filter((operation) => operation.type === 'number')
  .reduce((maximum, operation) => Math.max(maximum, operation.number), 0) + 1;

function commit(state, raw) {
  if (!TOOLS.has(raw?.type)) return state;
  const base = { id: `markup-${state.nextId}`, type: raw.type };
  const operation = raw.type === 'number'
    ? { ...base, point: point(raw.point), number: nextMarkerNumber(state) }
    : { ...base, start: point(raw.start), end: point(raw.end) };
  const next = { ...state, past: [...state.past, snapshot(state)], future: [], nextId: state.nextId + 1 };
  if (operation.type === 'crop') return { ...next, crop: rectangle(operation.start, operation.end) };
  return { ...next, operations: [...state.operations, operation] };
}

export function markupReducer(state, action) {
  if (action.type === 'select-tool') return { ...state, activeTool: action.tool || null };
  if (action.type === 'commit') return commit(state, action.operation);
  if (action.type === 'reset' && isMarkupDirty(state)) {
    return { ...state, crop: null, operations: [], past: [...state.past, snapshot(state)], future: [] };
  }
  if (action.type === 'undo' && state.past.length) {
    const previous = state.past.at(-1);
    return { ...state, ...previous, past: state.past.slice(0, -1), future: [snapshot(state), ...state.future] };
  }
  if (action.type === 'redo' && state.future.length) {
    const [next, ...future] = state.future;
    return { ...state, ...next, past: [...state.past, snapshot(state)], future };
  }
  return state;
}
