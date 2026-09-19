import React, { useEffect, useRef, useState } from 'react';
import { markupReducer } from '../domain/markup';
import { paintMarkupPreview } from '../utils/markupRenderer';
import { AppIcon } from './AppIcon';

const TOOLS = [
  ['crop', 'Crop', 'Crop'], ['arrow', 'Arrow', 'MoveUpRight'], ['number', 'Number', 'CircleDot'],
  ['highlight', 'Highlight', 'Highlighter'], ['blur', 'Blur', 'ScanLine'],
];

function normalizedPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
}

export function QuickMarkupEditor({ imageUrl, session, dispatch, onImageReady }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const gesture = useRef(null);
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [imageVersion, setImageVersion] = useState(0);

  useEffect(() => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      imageRef.current = image;
      const canvas = canvasRef.current;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      onImageReady(image);
      setImageVersion((version) => version + 1);
    };
    image.onerror = () => setLoadError('This screenshot cannot be prepared for markup.');
    image.src = imageUrl;
    return () => { image.onload = null; image.onerror = null; };
  }, [imageUrl, onImageReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const visible = preview
      ? markupReducer(session, { type: 'commit', operation: { type: session.activeTool, ...preview } })
      : session;
    paintMarkupPreview(canvas.getContext('2d'), image, visible);
  }, [imageVersion, preview, session]);

  const cancelGesture = () => { gesture.current = null; setPreview(null); };

  const handlePointerDown = (event) => {
    if (!session.activeTool) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = normalizedPoint(event.currentTarget, event);
    if (session.activeTool === 'number') {
      dispatch({ type: 'commit', operation: { type: 'number', point: start } });
      return;
    }
    gesture.current = start;
    setPreview({ start, end: start });
  };

  const handlePointerUp = (event) => {
    if (!gesture.current || !session.activeTool) return;
    const end = normalizedPoint(canvasRef.current, event);
    dispatch({ type: 'commit', operation: { type: session.activeTool, start: gesture.current, end } });
    cancelGesture();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && gesture.current) {
      event.preventDefault(); event.stopPropagation(); cancelGesture(); return;
    }
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    event.preventDefault(); dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
  };

  const reset = () => {
    if (!session.crop && !session.operations.length) return;
    if (window.confirm('Clear all markup from this screenshot?')) dispatch({ type: 'reset' });
  };

  return <div className="markup-editor" onKeyDown={handleKeyDown}>
    <div className="markup-toolbar" role="toolbar" aria-label="Quick Markup">
      <span>Quick Markup</span>
      {TOOLS.map(([tool, label, icon]) => <button
        key={tool} type="button" aria-label={label} aria-pressed={session.activeTool === tool}
        className={session.activeTool === tool ? 'active' : ''}
        onClick={() => dispatch({ type: 'select-tool', tool: session.activeTool === tool ? null : tool })}
      ><AppIcon name={icon} size={15} /><span>{label}</span></button>)}
      <i />
      <button type="button" aria-label="Undo" disabled={!session.past.length} onClick={() => dispatch({ type: 'undo' })}><AppIcon name="Undo2" size={15} /></button>
      <button type="button" aria-label="Redo" disabled={!session.future.length} onClick={() => dispatch({ type: 'redo' })}><AppIcon name="Redo2" size={15} /></button>
      <button type="button" aria-label="Reset" disabled={!session.crop && !session.operations.length} onClick={reset}><AppIcon name="RotateCcw" size={15} /></button>
    </div>
    <div className="markup-stage">
      {loadError ? <div className="markup-error" role="alert">{loadError}</div> : <canvas
        ref={canvasRef} tabIndex="0" aria-label="Screenshot markup canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={(event) => gesture.current && setPreview({ start: gesture.current, end: normalizedPoint(event.currentTarget, event) })}
        onPointerUp={handlePointerUp}
        onPointerCancel={cancelGesture}
      />}
    </div>
  </div>;
}
