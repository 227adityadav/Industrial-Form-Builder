"use client";

import * as React from "react";

type Props = {
  className?: string;
  /** Called when the drawing may have changed (including after clear). */
  onDrawingChange: (hasInk: boolean) => void;
};

/**
 * White canvas for mouse / touch drawing. Parent reads PNG via {@link SignaturePadHandle.getDataUrl}.
 */
export type SignaturePadHandle = {
  getDataUrl: () => string | null;
  clear: () => void;
};

export const SignaturePad = React.forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { className, onDrawingChange },
  ref
) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const hasInk = React.useRef(false);

  const notify = React.useCallback(() => {
    onDrawingChange(hasInk.current);
  }, [onDrawingChange]);

  const setupCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    hasInk.current = false;
    notify();
  }, [notify]);

  React.useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  React.useImperativeHandle(ref, () => ({
    getDataUrl: () => {
      const canvas = canvasRef.current;
      if (!canvas || !hasInk.current) return null;
      try {
        return canvas.toDataURL("image/png");
      } catch {
        return null;
      }
    },
    clear: () => {
      setupCanvas();
    },
  }));

  const last = React.useRef<{ x: number; y: number } | null>(null);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    if ("touches" in e && e.touches[0]) {
      return {
        x: (e.touches[0].clientX - r.left) * scaleX,
        y: (e.touches[0].clientY - r.top) * scaleY,
      };
    }
    const me = e as React.MouseEvent;
    return {
      x: (me.clientX - r.left) * scaleX,
      y: (me.clientY - r.top) * scaleY,
    };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    last.current = getPos(e);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk.current) {
      hasInk.current = true;
      notify();
    }
  }

  function end(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = false;
    last.current = null;
  }

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={160}
      className={
        className ??
        "w-full max-w-full touch-none rounded-xl border border-zinc-200 bg-white shadow-inner"
      }
      onMouseDown={start}
      onMouseMove={move}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchStart={start}
      onTouchMove={move}
      onTouchEnd={end}
    />
  );
});
