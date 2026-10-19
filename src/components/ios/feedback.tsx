"use client";

import { Check } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
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
