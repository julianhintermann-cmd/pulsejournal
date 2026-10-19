"use client";

import { useId, useMemo, useRef, useState } from "react";

import { haptic } from "@/lib/ios/haptics";

export type ScrubPoint = { ts: number; value: number };

const PAD_TOP = 12;
const PAD_BOTTOM = 8;

/**
 * Full-bleed line chart for phones with iOS Stocks style scrubbing (section 7.1): a horizontal drag starts scrubbing
 * immediately (the vertical axis stays with the page – `touch-action: pan-y`, the axis is decided after 8 px), a
 * hairline and dot follow the finger and `onScrub` reports the point; release resets to `null`.
 */
export function ScrubChart({
  points,
  height = 200,
  color,
  onScrub,
  label,
}: {
  points: ScrubPoint[];
  height?: number;
  color: string;
  onScrub?: (index: number | null) => void;
  label: string;
}) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const gesture = useRef<{ x: number; y: number; scrubbing: boolean; decided: boolean } | null>(null);
  const width = 1000; // viewBox width; the SVG scales to the container

  const { path, area, xs, ys } = useMemo(() => {
    if (points.length === 0) return { path: "", area: "", xs: [] as number[], ys: [] as number[] };
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const xs = points.map((_, i) => (points.length === 1 ? width / 2 : (i / (points.length - 1)) * width));
    const ys = values.map((v) => PAD_TOP + (1 - (v - min) / span) * (height - PAD_TOP - PAD_BOTTOM));
    const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
    const area = `${path} L${width},${height} L0,${height} Z`;
    return { path, area, xs, ys };
  }, [points, height]);

  const indexAt = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * (points.length - 1));
  };

  const update = (index: number | null) => {
    setActive(index);
    onScrub?.(index);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (points.length < 2) return;
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      scrubbing: event.pointerType === "mouse",
      decided: event.pointerType === "mouse",
    };
    if (event.pointerType === "mouse") {
      haptic("selection");
      update(indexAt(event.clientX));
    }
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) {
      if (event.pointerType === "mouse" && event.buttons === 0) return;
      return;
    }
    if (!g.decided) {
      const dx = Math.abs(event.clientX - g.x);
      const dy = Math.abs(event.clientY - g.y);
      if (dx < 8 && dy < 8) return;
      g.decided = true;
      g.scrubbing = dx > dy;
      if (!g.scrubbing) {
        gesture.current = null;
        return;
      }
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      haptic("selection");
    }
    if (g.scrubbing) {
      const index = indexAt(event.clientX);
      if (index !== active) update(index);
    }
  };
  const end = () => {
    gesture.current = null;
    if (active != null) update(null);
  };

  const ax = active != null ? xs[active] : null;
  const ay = active != null ? ys[active] : null;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      data-no-swipe-back
      className="relative w-full select-none"
      style={{ height, touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={(e) => e.pointerType === "mouse" && end()}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        <defs>
          <linearGradient id={`scrub-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#scrub-${id})`} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
        {ax != null ? (
          <line
            x1={ax}
            x2={ax}
            y1={0}
            y2={height}
            stroke="var(--ios-label-3)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {ax != null && ay != null ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-3 -translate-1/2 rounded-full border-2 border-[var(--bg)]"
          style={{ left: `${(ax / width) * 100}%`, top: ay, backgroundColor: color }}
        />
      ) : null}
    </div>
  );
}
