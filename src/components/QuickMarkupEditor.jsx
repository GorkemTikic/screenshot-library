import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  beginCropGesture, cropOperationChangesCrop, cropOperationForPoint, gestureMovedEnough,
} from '../domain/cropInteraction';
import { isMarkupDirty, markupReducer } from '../domain/markup';
import {
  isQuickMarkupDiscovered,
  markQuickMarkupDiscovered,
  shouldShowQuickMarkupTip,
} from '../domain/quickMarkupDiscovery';
import { paintMarkupPreview, previewCanvasGeometry } from '../utils/markupRenderer';
import { AppIcon } from './AppIcon';

const TOOLS = [
  ['crop', 'Crop', 'Crop'], ['arrow', 'Arrow', 'MoveUpRight'], ['number', 'Number', 'CircleDot'],
  ['highlight', 'Highlight', 'Highlighter'], ['blur', 'Blur', 'ScanLine'],
];

const requestPreviewFrame = (callback) => typeof requestAnimationFrame === 'function'
  ? { type: 'animation', id: requestAnimationFrame(callback) }
  : { type: 'timeout', id: setTimeout(callback, 16) };

function cancelPreviewFrame(frame) {
  if (!frame) return;
  if (frame.type === 'animation' && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame.id);
  if (frame.type === 'timeout') clearTimeout(frame.id);
}

function normalizedPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
}

function cropHitTolerance(canvas) {
  const rect = canvas.getBoundingClientRect();
  return { x: 14 / rect.width, y: 14 / rect.height };
}

function releasePointer(target, pointerId) {
  try {
    target?.releasePointerCapture?.(pointerId);
  } catch {
    // The browser may already have released capture after pointer cancellation.
  }
}

function QuickMarkupSession({ imageUrl, session, dispatch, onImageReady, showTip = false, onSoftDismiss, onTryMarkup }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const sessionRef = useRef(session);
  const gestureRef = useRef(null);
  const previewRef = useRef(null);
  const frameRef = useRef(null);
  const loadGeneration = useRef(0);
  const [loadState, setLoadState] = useState({ status: 'loading', error: '' });
  const imageReady = loadState.status === 'ready';

  const queuePreviewPaint = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestPreviewFrame(() => {
      frameRef.current = null;
      const canvas = canvasRef.current;
      const image = imageRef.current;
      if (!canvas || !image) return;
      const currentSession = sessionRef.current;
      const visible = previewRef.current
        ? markupReducer(currentSession, { type: 'commit', operation: previewRef.current })
        : currentSession;
      paintMarkupPreview(canvas.getContext('2d'), image, visible, {
        width: canvas.width,
        height: canvas.height,
      });
    });
  }, []);

  const sizePreviewCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const stageRect = stageRef.current?.getBoundingClientRect?.() || canvas.getBoundingClientRect();
    const geometry = previewCanvasGeometry(
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
      stageRect.width,
      stageRect.height,
      globalThis.devicePixelRatio,
    );
    canvas.width = geometry.width;
    canvas.height = geometry.height;
    if (canvas.style) {
      canvas.style.width = `${geometry.cssWidth}px`;
      canvas.style.height = `${geometry.cssHeight}px`;
    }
    queuePreviewPaint();
  }, [queuePreviewPaint]);

  const cancelGesture = useCallback((pointerId = gestureRef.current?.pointerId, target = canvasRef.current) => {
    const active = gestureRef.current;
    if (!active || active.pointerId !== pointerId) return false;
    releasePointer(target, active.pointerId);
    gestureRef.current = null;
    previewRef.current = null;
    queuePreviewPaint();
    return true;
  }, [queuePreviewPaint]);

  useEffect(() => {
    sessionRef.current = session;
    queuePreviewPaint();
  }, [queuePreviewPaint, session]);

  useEffect(() => {
    const generation = loadGeneration.current + 1;
    const pointerTarget = canvasRef.current;
    loadGeneration.current = generation;
    let cancelled = false;
    imageRef.current = null;
    previewRef.current = null;
    gestureRef.current = null;
    onImageReady(null);

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (cancelled || loadGeneration.current !== generation) return;
      imageRef.current = image;
      setLoadState({ status: 'ready', error: '' });
      onImageReady(image);
      sizePreviewCanvas();
    };
    image.onerror = () => {
      if (cancelled || loadGeneration.current !== generation) return;
      imageRef.current = null;
      previewRef.current = null;
      setLoadState({ status: 'error', error: 'This screenshot cannot be prepared for markup.' });
      onImageReady(null);
      queuePreviewPaint();
    };
    image.src = imageUrl;

    return () => {
      cancelled = true;
      if (loadGeneration.current === generation) loadGeneration.current += 1;
      image.onload = null;
      image.onerror = null;
      releasePointer(pointerTarget, gestureRef.current?.pointerId);
      gestureRef.current = null;
      previewRef.current = null;
      imageRef.current = null;
      cancelPreviewFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [imageUrl, onImageReady, queuePreviewPaint, sizePreviewCanvas]);

  useEffect(() => {
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(sizePreviewCanvas);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [sizePreviewCanvas]);

  useEffect(() => () => {
    cancelPreviewFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const operationAtPoint = (current) => gestureRef.current?.kind === 'draw'
    ? { type: gestureRef.current.tool, start: gestureRef.current.start, end: current }
    : cropOperationForPoint(gestureRef.current, current);

  const handlePointerDown = (event) => {
    if (!imageReady || !session.activeTool || gestureRef.current) return;
    const start = normalizedPoint(event.currentTarget, event);
    if (session.activeTool === 'number') {
      dispatch({ type: 'commit', operation: { type: 'number', point: start } });
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const interaction = session.activeTool === 'crop'
      ? beginCropGesture(session.crop, start, cropHitTolerance(event.currentTarget))
      : { kind: 'draw', tool: session.activeTool, start };
    gestureRef.current = {
      ...interaction,
      pointerId: event.pointerId,
      clientStart: { x: event.clientX, y: event.clientY },
      initialCrop: session.crop,
    };
    previewRef.current = session.activeTool === 'crop'
      ? cropOperationForPoint(gestureRef.current, start)
      : { type: session.activeTool, start, end: start };
    queuePreviewPaint();
  };

  const handlePointerMove = (event) => {
    const active = gestureRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    previewRef.current = operationAtPoint(normalizedPoint(event.currentTarget, event));
    queuePreviewPaint();
  };

  const handlePointerUp = (event) => {
    const active = gestureRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const operation = operationAtPoint(normalizedPoint(event.currentTarget, event));
    const moved = gestureMovedEnough(active.clientStart, { x: event.clientX, y: event.clientY });
    const changed = operation.type !== 'crop' || cropOperationChangesCrop(active.initialCrop, operation);
    cancelGesture(event.pointerId, event.currentTarget);
    if (moved && changed) dispatch({ type: 'commit', operation });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && gestureRef.current) {
      event.preventDefault();
      event.stopPropagation();
      cancelGesture();
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
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
        disabled={!imageReady}
        className={session.activeTool === tool ? 'active' : ''}
        onClick={() => dispatch({ type: 'select-tool', tool: session.activeTool === tool ? null : tool })}
      ><AppIcon name={icon} size={15} /><span>{label}</span></button>)}
      <i />
      <button type="button" aria-label="Undo" disabled={!session.past.length} onClick={() => dispatch({ type: 'undo' })}><AppIcon name="Undo2" size={15} /></button>
      <button type="button" aria-label="Redo" disabled={!session.future.length} onClick={() => dispatch({ type: 'redo' })}><AppIcon name="Redo2" size={15} /></button>
      <button type="button" aria-label="Reset" disabled={!session.crop && !session.operations.length} onClick={reset}><AppIcon name="RotateCcw" size={15} /></button>
    </div>
    {showTip && (
      <div className="markup-discovery-tip" role="status">
        <div className="markup-discovery-tip-copy">
          <AppIcon name="Sparkles" size={14} />
          <p>
            <strong>What's new:</strong> Crop, arrow, number, highlight, or blur — then Copy Screenshot.
            The catalog original stays untouched.
          </p>
        </div>
        <div className="markup-discovery-tip-actions">
          <button type="button" className="markup-discovery-try" onClick={onTryMarkup}>Try arrow</button>
          <button type="button" className="markup-discovery-dismiss" onClick={onSoftDismiss}>Got it</button>
        </div>
      </div>
    )}
    <div ref={stageRef} className="markup-stage">
      <canvas
        ref={canvasRef} tabIndex="0" aria-label="Screenshot markup canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={(event) => cancelGesture(event.pointerId, event.currentTarget)}
      />
      {loadState.error && <div className="markup-error" role="alert">{loadState.error}</div>}
    </div>
  </div>;
}

export function QuickMarkupEditor(props) {
  const [softDismissed, setSoftDismissed] = useState(false);
  const dirty = isMarkupDirty(props.session);

  useEffect(() => {
    if (dirty) markQuickMarkupDiscovered();
  }, [dirty]);

  const discovered = dirty || isQuickMarkupDiscovered();
  const showTip = shouldShowQuickMarkupTip({ discovered, softDismissed });

  return (
    <QuickMarkupSession
      key={props.imageUrl}
      {...props}
      showTip={showTip}
      onSoftDismiss={() => setSoftDismissed(true)}
      onTryMarkup={() => {
        props.dispatch({ type: 'select-tool', tool: 'arrow' });
        setSoftDismissed(true);
      }}
    />
  );
}
