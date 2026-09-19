const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const point = (value = {}) => ({ x: clamp(value.x), y: clamp(value.y) });

const cropCorners = (crop) => ({
  nw: { x: crop.x, y: crop.y },
  ne: { x: crop.x + crop.width, y: crop.y },
  sw: { x: crop.x, y: crop.y + crop.height },
  se: { x: crop.x + crop.width, y: crop.y + crop.height },
});

export function cropTargetAtPoint(crop, rawPoint, tolerance = { x: 0.02, y: 0.02 }) {
  if (!crop) return { kind: 'create' };
  const location = point(rawPoint);
  const corners = cropCorners(crop);
  for (const [corner, handle] of Object.entries(corners)) {
    if (Math.abs(location.x - handle.x) <= tolerance.x && Math.abs(location.y - handle.y) <= tolerance.y) {
      return { kind: 'resize', corner };
    }
  }
  const inside = location.x >= crop.x && location.x <= crop.x + crop.width
    && location.y >= crop.y && location.y <= crop.y + crop.height;
  return { kind: inside ? 'move' : 'create' };
}

export function beginCropGesture(crop, rawPoint, tolerance) {
  const origin = point(rawPoint);
  const target = cropTargetAtPoint(crop, origin, tolerance);
  if (target.kind === 'resize') {
    const opposite = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' }[target.corner];
    return { kind: 'resize', anchor: cropCorners(crop)[opposite] };
  }
  if (target.kind === 'move') return { kind: 'move', origin, crop: { ...crop } };
  return { kind: 'create', origin };
}

export function cropOperationForPoint(gesture, rawPoint) {
  const current = point(rawPoint);
  if (gesture.kind === 'resize') {
    return { type: 'crop', start: gesture.anchor, end: current };
  }
  if (gesture.kind === 'move') {
    const maximumX = 1 - gesture.crop.width;
    const maximumY = 1 - gesture.crop.height;
    const x = Math.max(0, Math.min(maximumX, gesture.crop.x + current.x - gesture.origin.x));
    const y = Math.max(0, Math.min(maximumY, gesture.crop.y + current.y - gesture.origin.y));
    return {
      type: 'crop',
      start: { x, y },
      end: { x: x + gesture.crop.width, y: y + gesture.crop.height },
    };
  }
  return { type: 'crop', start: gesture.origin, end: current };
}
