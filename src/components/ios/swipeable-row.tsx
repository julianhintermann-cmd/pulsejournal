"use client";

import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { haptic } from "@/lib/ios/haptics";
import { cn } from "@/lib/utils";

export type SwipeAction = {
  label: string;
  icon?: LucideIcon;
  /** Background colour (CSS value). */
  color: string;
  onAction: () => void;
};

const ACTION_WIDTH = 74;
const FULL_SWIPE = 0.6;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** Only one row is open at a time: opening a row closes the previous one. */
type Registration = { close: () => void };
let openRow: Registration | null = null;

/**
 * iOS swipe actions (section 6): swipe left reveals the trailing actions (the first one fires on a full swipe past
 * 60 %, with a haptic), swipe right the leading ones. The row follows the finger 1:1, buttons grow with the swipe,
 * and the axis locks after 10 px so vertical scrolling is never stolen.
 */
export function SwipeableRow({
  leading = [],
  trailing = [],
  children,
  className,
}: {
  leading?: SwipeAction[];
  trailing?: SwipeAction[];
  children: React.ReactNode;
  className?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const offset = useRef(0); // resting offset: 0, +lead width or −trail width
  const gesture = useRef<{
    x: number;
    y: number;
    t: number;
    decided: boolean;
    horizontal: boolean;
    last: { x: number; t: number }[];
    beyond: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  const leadWidth = leading.length * ACTION_WIDTH;
  const trailWidth = trailing.length * ACTION_WIDTH;

  const paint = useCallback((x: number, animated: boolean) => {
    const content = contentRef.current;
    if (!content) return;
    const transition = animated ? `transform 380ms ${EASE}` : "none";
    content.style.transition = transition;
    content.style.transform = x ? `translate3d(${x}px, 0, 0)` : "";
    for (const [el, visible] of [
      [leadRef.current, x > 0],
      [trailRef.current, x < 0],
    ] as const) {
      if (!el) continue;
      el.style.transition = animated ? `width 380ms ${EASE}` : "none";
      el.style.width = visible ? `${Math.abs(x)}px` : "0px";
    }
  }, []);

  const registration = useRef<Registration>({ close: () => undefined });
  const settle = useCallback(
    (x: number) => {
      offset.current = x;
      paint(x, true);
      if (x !== 0) {
        if (openRow && openRow !== registration.current) openRow.close();
        openRow = registration.current;
      } else if (openRow === registration.current) openRow = null;
    },
    [paint],
  );

  // Tap anywhere else closes an open row.
  useEffect(() => {
    const own = registration.current;
    own.close = () => settle(0);
    const onDown = (event: PointerEvent) => {
      if (offset.current !== 0 && !rowRef.current?.contains(event.target as Node)) settle(0);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      if (openRow === own) openRow = null;
    };
  }, [settle]);

  const fire = (action: SwipeAction, direction: 1 | -1) => {
    const width = rowRef.current?.offsetWidth ?? 400;
    haptic("medium");
    paint(direction * width, true);
    window.setTimeout(() => {
      action.onAction();
      settle(0);
    }, 260);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      t: event.timeStamp,
      decided: false,
      horizontal: false,
      last: [{ x: event.clientX, t: event.timeStamp }],
      beyond: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!g.decided) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      g.decided = true;
      g.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!g.horizontal) {
        gesture.current = null;
        return;
      }
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      if (openRow && openRow !== registration.current) openRow.close();
    }
    let x = offset.current + dx;
    // Directions without actions only rubber-band a little.
    if (x > 0 && !leadWidth) x = Math.pow(x, 0.6);
    if (x < 0 && !trailWidth) x = -Math.pow(-x, 0.6);
    const width = rowRef.current?.offsetWidth ?? 400;
    const beyond = Math.abs(x) > width * FULL_SWIPE && ((x < 0 && trailWidth > 0) || (x > 0 && leadWidth > 0));
    if (beyond !== g.beyond) {
      g.beyond = beyond;
      haptic("light");
    }
    g.last.push({ x: event.clientX, t: event.timeStamp });
    if (g.last.length > 5) g.last.shift();
    paint(x, false);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.horizontal) return;
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 350);
    const dx = event.clientX - g.x;
    const x = offset.current + dx;
    const first = g.last[0];
    const last = g.last[g.last.length - 1];
    const velocity = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
    if (g.beyond) {
      if (x < 0 && trailing[0]) return fire(trailing[0], -1);
      if (x > 0 && leading[0]) return fire(leading[0], 1);
    }
    if (x < 0 && trailWidth && (x < -trailWidth / 2 || velocity < -0.5)) return settle(-trailWidth);
    if (x > 0 && leadWidth && (x > leadWidth / 2 || velocity > 0.5)) return settle(leadWidth);
    settle(0);
  };

  return (
    <div ref={rowRef} data-swipe-row className={cn("ios-swipe", className)}>
      {leading.length ? <SwipeActions ref={leadRef} side="leading" actions={leading} onDone={() => settle(0)} /> : null}
      {trailing.length ? (
        <SwipeActions ref={trailRef} side="trailing" actions={trailing} onDone={() => settle(0)} />
      ) : null}
      <div
        ref={contentRef}
        className="ios-swipe__content"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          gesture.current = null;
          settle(offset.current);
        }}
        onClickCapture={(event) => {
          // A swipe or a tap on an open row never opens the row's link.
          if (suppressClick.current || offset.current !== 0) {
            event.preventDefault();
            event.stopPropagation();
            if (offset.current !== 0) settle(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SwipeActions({
  ref,
  side,
  actions,
  onDone,
}: {
  ref: React.Ref<HTMLDivElement>;
  side: "leading" | "trailing";
  actions: SwipeAction[];
  onDone: () => void;
}) {
  return (
    <div
      ref={ref}
      className={cn("ios-swipe__actions", `ios-swipe__actions--${side}`)}
      style={{ width: 0 }}
      // Swipe actions are an accelerator; the same actions are in the long-press menu and on the detail screen.
      aria-hidden="true"
    >
      {(side === "trailing" ? [...actions].reverse() : actions).map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            tabIndex={-1}
            className="ios-swipe__action flex-1"
            style={{ backgroundColor: action.color }}
            onClick={() => {
              action.onAction();
              onDone();
            }}
          >
            {Icon ? <Icon className="size-5" strokeWidth={2} aria-hidden="true" /> : null}
            <span className="truncate">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
