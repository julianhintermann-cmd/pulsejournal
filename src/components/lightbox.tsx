"use client";

import { ChevronLeft, ChevronRight, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type LightboxImage = { src: string; caption?: string | null; width: number; height: number };

type Transform = { scale: number; x: number; y: number };
const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

/** Full-screen image viewer: swipe / arrow keys between images, pinch or double-tap to zoom. */
export function Lightbox({
  images,
  index,
  onIndexChange,
  open,
  onOpenChange,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [swipeX, setSwipeX] = useState(0);
  // Vertical drag on an unzoomed image dismisses the viewer (iOS Photos).
  const [swipeY, setSwipeY] = useState(0);
  const axis = useRef<"x" | "y" | null>(null);
  const [gesturing, setGesturing] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startDist: number;
    startScale: number;
    startX: number;
    startY: number;
    origin: Transform;
    lastTap: number;
  }>({ startDist: 0, startScale: 1, startX: 0, startY: 0, origin: IDENTITY, lastTap: 0 });

  const count = images.length;
  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setTransform(IDENTITY);
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  const image = images[index];

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setGesturing(true);
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    g.origin = transform;
    if (pts.length === 2) {
      g.startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      g.startScale = transform.scale;
    } else if (pts.length === 1) {
      g.startX = e.clientX;
      g.startY = e.clientY;
      axis.current = null;
      const now = Date.now();
      if (now - g.lastTap < 280) {
        setTransform(transform.scale > 1 ? IDENTITY : { scale: 2.5, x: 0, y: 0 });
        g.lastTap = 0;
      } else g.lastTap = now;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    if (pts.length === 2 && g.startDist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const scale = Math.min(4, Math.max(1, (g.startScale * dist) / g.startDist));
      setTransform((t) => ({ ...t, scale }));
    } else if (pts.length === 1) {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (g.origin.scale > 1) setTransform({ scale: g.origin.scale, x: g.origin.x + dx, y: g.origin.y + dy });
      else {
        if (!axis.current && Math.hypot(dx, dy) > 8) axis.current = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
        if (axis.current === "y") setSwipeY(dy);
        else if (axis.current === "x") setSwipeX(dx);
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      setGesturing(false);
      if (transform.scale <= 1.02) {
        if (Math.abs(swipeY) > 120) {
          setSwipeY(0);
          setSwipeX(0);
          setTransform(IDENTITY);
          onOpenChange(false);
          return;
        }
        if (swipeX > 60) go(-1);
        else if (swipeX < -60) go(1);
        setTransform(IDENTITY);
      }
      setSwipeX(0);
      setSwipeY(0);
    } else {
      const [rest] = [...pointers.current.values()];
      gesture.current.startX = rest.x;
      gesture.current.startY = rest.y;
      gesture.current.origin = transform;
    }
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setTransform(IDENTITY);
        onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[60] bg-black/95 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          style={{ opacity: 1 - Math.min(0.7, Math.abs(swipeY) / 400) }}
        />
        <DialogPrimitive.Content
          data-allow-zoom
          className="fixed inset-0 z-[60] flex flex-col outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            Screenshot {index + 1} von {count}
          </DialogPrimitive.Title>
          <div className="flex shrink-0 items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 text-white">
            <span className="text-small text-white/70 tabular-nums">
              {index + 1} / {count}
            </span>
            <DialogPrimitive.Close className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
              <XIcon className="size-5" />
              <span className="sr-only">Schliessen</span>
            </DialogPrimitive.Close>
          </div>
          <div
            className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- auth-protected upload served by the API route
              <img
                key={image.src}
                src={image.src}
                alt={image.caption ?? ""}
                width={image.width}
                height={image.height}
                draggable={false}
                className={cn(
                  "max-h-full max-w-full object-contain",
                  !gesturing && "transition-transform duration-200 ease-pulse",
                )}
                style={{
                  transform: `translate3d(${transform.x + swipeX}px, ${transform.y + swipeY}px, 0) scale(${
                    transform.scale * (1 - Math.min(0.25, Math.abs(swipeY) / 1200))
                  })`,
                }}
              />
            ) : null}
            {count > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Vorheriges Bild"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => go(-1)}
                  className="absolute top-1/2 left-3 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 md:flex"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Nächstes Bild"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => go(1)}
                  className="absolute top-1/2 right-3 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 md:flex"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            ) : null}
          </div>
          <div className="min-h-12 shrink-0 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] text-center text-body text-white/80">
            {image?.caption ?? ""}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
