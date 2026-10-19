"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";

import { haptic } from "@/lib/ios/haptics";
import { cn } from "@/lib/utils";

/** iOS activity indicator: 8 rounded spokes stepping around once per second (no circular web spinner). */
export function ActivityIndicator({ className, label = "Lädt" }: { className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="status" aria-label={label} className={cn("ios-activity size-5", className)}>
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={i}
          x1="12"
          y1="2.8"
          x2="12"
          y2="7.4"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity={0.18 + (i / 7) * 0.82}
          transform={`rotate(${i * 45} 12 12)`}
        />
      ))}
    </svg>
  );
}

/** Redacted placeholder (rounded gray block with a slow 1.5 s opacity pulse – no shimmer sweep). */
export function Redacted({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("ios-redacted rounded-[8px]", className)} />;
}

// ---------- Checkmark HUD ("Hinzugefügt") ----------

type Hud = { id: number; label: string } | null;
let hud: Hud = null;
const listeners = new Set<() => void>();
let hideTimer = 0;

/** Shows the centred glass checkmark HUD for ~1 s (phones; desktop keeps its toasts). */
export function showCheckmarkHud(label: string) {
  if (typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches) return;
  hud = { id: Date.now(), label };
  for (const l of listeners) l();
  haptic("success");
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    hud = null;
    for (const l of listeners) l();
  }, 1100);
}

export function CheckmarkHudHost() {
  const current = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => hud,
    () => null,
  );
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- portals need the browser document
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    current ? (
      <div key={current.id} role="status" aria-live="polite" className="ios-hud">
        <div className="glass ios-hud__card">
          <Check className="ios-hud__check" strokeWidth={3} aria-hidden="true" />
          <span className="text-[15px] font-semibold">{current.label}</span>
        </div>
      </div>
    ) : null,
    document.body,
  );
}

/** Success feedback for a save: the checkmark HUD on phones, a toast on larger screens. */
export function notifySaved(message: string, hudLabel = "Gespeichert") {
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) showCheckmarkHud(hudLabel);
  else void import("sonner").then(({ toast }) => toast.success(message));
}

// ---------- Pull to refresh (section 6) ----------

const PTR_THRESHOLD = 80;
const PTR_HOLD = 56;

/**
 * Pull to refresh for list screens on phones: the iOS activity indicator appears behind the large title, a haptic
 * fires at ~80 px and `router.refresh()` runs; content stays pushed down until the refresh finished. On iPhone the
 * native rubber band provides the pull (negative scrollY); elsewhere a JS rubber band is used.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const nativeBounce = CSS.supports("-webkit-touch-callout", "none");
    const main = () => document.getElementById("main");
    let startY: number | null = null;
    let startX = 0;
    let pull = 0;
    let armed = false;
    let busy = false;

    const show = (distance: number) => {
      const el = indicatorRef.current;
      if (!el) return;
      const progress = Math.min(1, distance / PTR_THRESHOLD);
      el.style.opacity = String(progress);
      el.style.transform = `rotate(${progress * 270}deg) scale(${0.6 + progress * 0.4})`;
      if (progress >= 1 && !armed) {
        armed = true;
        haptic("light");
      } else if (progress < 1) armed = false;
    };

    const springBack = () => {
      const m = main();
      if (m && !nativeBounce) {
        m.style.transition = "transform 380ms cubic-bezier(0.32, 0.72, 0, 1)";
        m.style.transform = "";
      }
      show(0);
    };

    const onStart = (event: TouchEvent) => {
      if (busy || window.scrollY > 0 || event.touches.length !== 1) return;
      if (document.documentElement.hasAttribute("data-presented")) return;
      startY = event.touches[0].clientY;
      startX = event.touches[0].clientX;
      pull = 0;
      armed = false;
    };
    const onMove = (event: TouchEvent) => {
      if (startY == null) return;
      if (nativeBounce) {
        pull = Math.max(0, -window.scrollY);
        show(pull);
        return;
      }
      const dy = event.touches[0].clientY - startY;
      const dx = event.touches[0].clientX - startX;
      // Horizontal gestures (swipe back, swipe actions) are not a pull.
      if (dy <= 0 || window.scrollY > 0 || (pull === 0 && Math.abs(dx) > dy)) {
        if (pull > 0) springBack();
        startY = null;
        pull = 0;
        return;
      }
      event.preventDefault();
      pull = dy * 0.5;
      const m = main();
      if (m) {
        m.style.transition = "none";
        m.style.transform = `translate3d(0, ${pull}px, 0)`;
      }
      show(pull);
    };
    const onScroll = () => {
      if (nativeBounce && startY != null) {
        pull = Math.max(0, -window.scrollY);
        show(pull);
      }
    };
    const onEnd = () => {
      if (startY == null) return;
      startY = null;
      if (pull >= PTR_THRESHOLD) {
        busy = true;
        const m = main();
        if (m) {
          m.style.transition = "transform 380ms cubic-bezier(0.32, 0.72, 0, 1)";
          m.style.transform = `translate3d(0, ${PTR_HOLD}px, 0)`;
        }
        startedAt.current = Date.now();
        setRefreshing(true);
        startTransition(() => router.refresh());
      } else springBack();
      pull = 0;
    };
    const onDone = () => {
      busy = false;
      springBack();
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pulse:ptr-done", onDone);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pulse:ptr-done", onDone);
      const m = main();
      if (m) m.style.transform = "";
    };
  }, [router]);

  // Finish once the refresh committed, but show the indicator for at least 600 ms.
  useEffect(() => {
    if (!refreshing || pending) return;
    const wait = Math.max(0, 600 - (Date.now() - startedAt.current));
    const timer = window.setTimeout(() => {
      setRefreshing(false);
      window.dispatchEvent(new Event("pulse:ptr-done"));
    }, wait);
    return () => window.clearTimeout(timer);
  }, [refreshing, pending]);

  return (
    <div
      ref={indicatorRef}
      className="ios-ptr md:hidden"
      data-refreshing={refreshing ? "" : undefined}
      aria-hidden={!refreshing}
    >
      <ActivityIndicator className={cn("size-7", !refreshing && "[animation:none]")} label="Aktualisiert" />
    </div>
  );
}
