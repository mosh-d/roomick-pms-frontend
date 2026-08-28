'use client';

import { forwardRef, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from './Button';

export interface SignaturePadHandle {
  /** `null` when nothing has been drawn yet — the caller decides whether an empty signature is acceptable. */
  getDataUrl: () => string | null;
  clear: () => void;
}

/**
 * Hand-rolled canvas drawing, not a library — the same "no headless-UI
 * primitive for this" call `Modal.tsx`/`Select.tsx` already made. Pointer
 * Events (not separate mouse/touch handlers) cover mouse, touch, AND
 * stylus in one code path — exactly the "touch/mouse/stylus" the
 * reference calls for.
 *
 * Uncontrolled by design: the canvas owns its own drawing state, and the
 * caller reads it out via `ref.current.getDataUrl()` only at the moment
 * it actually needs the value (the Sign button's click handler) — a
 * signature pad re-rendering (and losing the in-progress stroke) on every
 * parent state change would be a real bug, not just wasted work.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { label?: string }>(function SignaturePad({ label = 'Signature' }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useImperativeHandle(ref, () => ({
    getDataUrl: () => {
      if (!hasDrawnRef.current || !canvasRef.current) return null;
      return canvasRef.current.toDataURL('image/png');
    },
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawnRef.current = false;
      setHasDrawn(false);
    },
  }));

  function pointFor(event: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const { x, y } = pointFor(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointFor(event);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#160029';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      setHasDrawn(true);
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    setHasDrawn(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-small font-semibold text-secondary">{label}</span>
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full max-w-[500px] touch-none rounded-card border border-secondary-light/40 bg-white"
      />
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={clearCanvas} disabled={!hasDrawn}>
          Clear
        </Button>
        {!hasDrawn ? <span className="text-tiny text-secondary-light">Sign above with mouse, touch, or stylus</span> : null}
      </div>
    </div>
  );
});
