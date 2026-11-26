"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type AvatarShape = "circle" | "rounded";

type Props = {
  file: File;
  initialShape?: AvatarShape;
  onCancel: () => void;
  onConfirm: (blob: Blob, shape: AvatarShape) => void;
};

const OUTPUT_SIZE = 512;

export function AvatarCropper({
  file,
  initialShape = "circle",
  onCancel,
  onConfirm,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [shape, setShape] = useState<AvatarShape>(initialShape);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = url;
    return () => {
      URL.revokeObjectURL(url);
      imgRef.current = null;
    };
  }, [file]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const view = 320;
    canvas.width = view;
    canvas.height = view;

    const base = Math.max(view / img.width, view / img.height);
    const scale = base * zoom;
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (view - w) / 2 + offset.x;
    const y = (view - h) / 2 + offset.y;

    ctx.clearRect(0, 0, view, view);
    ctx.drawImage(img, x, y, w, h);

    // Dim outside crop zone
    ctx.save();
    ctx.fillStyle = "rgba(168, 168, 168, 0.55)";
    ctx.fillRect(0, 0, view, view);
    ctx.globalCompositeOperation = "destination-out";
    const pad = 28;
    const size = view - pad * 2;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(view / 2, view / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const r = 28;
      roundRect(ctx, pad, pad, size, size, r);
      ctx.fill();
    }
    ctx.restore();

    // Crop border
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(view / 2, view / 2, size / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const r = 28;
      roundRect(ctx, pad, pad, size, size, r);
      ctx.stroke();
    }
  }, [offset.x, offset.y, shape, zoom]);

  useEffect(() => {
    if (ready) draw();
  }, [ready, draw]);

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  }

  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  }

  async function confirm() {
    const img = imgRef.current;
    if (!img) return;
    setBusy(true);
    try {
      const view = 320;
      const pad = 28;
      const cropSize = view - pad * 2;
      const base = Math.max(view / img.width, view / img.height);
      const scale = base * zoom;
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (view - w) / 2 + offset.x;
      const y = (view - h) / 2 + offset.y;

      const out = document.createElement("canvas");
      out.width = OUTPUT_SIZE;
      out.height = OUTPUT_SIZE;
      const ctx = out.getContext("2d");
      if (!ctx) return;

      // Map crop window back into image space via an offscreen full view draw
      const full = document.createElement("canvas");
      full.width = view;
      full.height = view;
      const fctx = full.getContext("2d");
      if (!fctx) return;
      fctx.drawImage(img, x, y, w, h);

      ctx.drawImage(
        full,
        pad,
        pad,
        cropSize,
        cropSize,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Couldn’t export crop.");
      onConfirm(blob, shape);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A3D45]/55 p-4">
      <div className="tide-panel w-full max-w-md space-y-4 p-5 shadow-xl">
        <h3 className="font-semibold text-[#0A3D45]">Fit your photo</h3>
        <p className="text-xs text-[#0A3D45]/65">
          Drag to position, zoom to frame. The clear zone is what people will
          see.
        </p>

        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={320}
            height={320}
            className="max-w-full touch-none cursor-grab active:cursor-grabbing rounded-lg bg-[#0A3D45]/10"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>

        <label className="block text-sm text-[#0A3D45]">
          <span className="mb-1 block font-medium">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            className={`tide-btn-secondary flex-1 text-sm ${
              shape === "circle" ? "ring-2 ring-[#0A3D45]/40" : ""
            }`}
            onClick={() => setShape("circle")}
          >
            Circle
          </button>
          <button
            type="button"
            className={`tide-btn-secondary flex-1 text-sm ${
              shape === "rounded" ? "ring-2 ring-[#0A3D45]/40" : ""
            }`}
            onClick={() => setShape("rounded")}
          >
            Rounded box
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="tide-btn-secondary text-sm"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="tide-btn text-sm disabled:opacity-60"
            onClick={() => void confirm()}
            disabled={!ready || busy}
          >
            {busy ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
