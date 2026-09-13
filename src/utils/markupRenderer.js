const px = (value, size) => Math.round(value * size);

export const sourcePoint = (point, width, height) => ({
  x: px(point.x, width),
  y: px(point.y, height),
});

export function sourceRectangle(operation, width, height) {
  const start = sourcePoint(operation.start, width, height);
  const end = sourcePoint(operation.end, width, height);
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.max(1, Math.abs(end.x - start.x)),
    height: Math.max(1, Math.abs(end.y - start.y)),
  };
}

export function outputGeometry(width, height, crop) {
  if (!crop) return { x: 0, y: 0, width, height };
  return {
    x: px(crop.x, width),
    y: px(crop.y, height),
    width: Math.max(1, px(crop.width, width)),
    height: Math.max(1, px(crop.height, height)),
  };
}

function drawArrow(context, operation, width, height) {
  const start = sourcePoint(operation.start, width, height);
  const end = sourcePoint(operation.end, width, height);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const lineWidth = Math.max(5, Math.round(Math.min(width, height) * 0.008));
  const head = lineWidth * 4;

  context.save();
  context.strokeStyle = '#ff5c35';
  context.fillStyle = '#ff5c35';
  context.lineWidth = lineWidth;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(
    end.x - head * Math.cos(angle - Math.PI / 6),
    end.y - head * Math.sin(angle - Math.PI / 6),
  );
  context.lineTo(
    end.x - head * Math.cos(angle + Math.PI / 6),
    end.y - head * Math.sin(angle + Math.PI / 6),
  );
  context.closePath();
  context.fill();
  context.restore();
}

function drawNumber(context, operation, width, height) {
  const location = sourcePoint(operation.point, width, height);
  const radius = Math.max(18, Math.round(Math.min(width, height) * 0.035));

  context.save();
  context.fillStyle = '#ff5c35';
  context.beginPath();
  context.arc(location.x, location.y, radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#fff';
  context.font = `700 ${Math.round(radius * 1.15)}px Arial, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(operation.number), location.x, location.y + 1);
  context.restore();
}

function drawHighlight(context, operation, width, height) {
  const rect = sourceRectangle(operation, width, height);

  context.save();
  context.fillStyle = 'rgba(255, 213, 53, 0.28)';
  context.strokeStyle = '#ffd535';
  context.lineWidth = Math.max(4, Math.round(Math.min(width, height) * 0.006));
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  context.strokeRect(rect.x, rect.y, rect.width, rect.height);
  context.restore();
}

function drawBlur(context, image, operation, width, height) {
  const rect = sourceRectangle(operation, width, height);

  context.save();
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
  context.filter = `blur(${Math.max(10, Math.round(Math.min(width, height) * 0.016))}px)`;
  context.drawImage(image, 0, 0, width, height);
  context.restore();
}

export function paintMarkup(context, image, session) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  for (const type of ['blur', 'highlight', 'arrow', 'number']) {
    for (const operation of session.operations.filter((item) => item.type === type)) {
      if (type === 'blur') drawBlur(context, image, operation, width, height);
      if (type === 'highlight') drawHighlight(context, operation, width, height);
      if (type === 'arrow') drawArrow(context, operation, width, height);
      if (type === 'number') drawNumber(context, operation, width, height);
    }
  }
}

const canvasBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob(
  (blob) => blob
    ? resolve(blob)
    : reject(Object.assign(new Error('PNG encoding failed'), { code: 'IMAGE_ENCODE_FAILED' })),
  'image/png',
));

export async function renderMarkupPng(image, session, documentRef = document) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const source = documentRef.createElement('canvas');
  source.width = width;
  source.height = height;
  paintMarkup(source.getContext('2d'), image, session);

  const geometry = outputGeometry(width, height, session.crop);
  if (!session.crop) return canvasBlob(source);

  const output = documentRef.createElement('canvas');
  output.width = geometry.width;
  output.height = geometry.height;
  output.getContext('2d').drawImage(
    source,
    geometry.x,
    geometry.y,
    geometry.width,
    geometry.height,
    0,
    0,
    geometry.width,
    geometry.height,
  );
  return canvasBlob(output);
}
