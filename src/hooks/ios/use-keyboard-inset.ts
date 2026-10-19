"use client";

import { useSyncExternalStore } from "react";

let inset = 0;
const listeners = new Set<() => void>();
let attached = false;

function measure() {
  const vv = window.visualViewport;
  const next = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
  // Ignore small differences (Safari toolbars collapsing); a software keyboard is far taller.
  const value = next > 120 ? next : 0;
  if (value === inset) return;
  inset = value;
  document.documentElement.style.setProperty("--kb", `${value}px`);
  document.documentElement.toggleAttribute("data-keyboard", value > 0);
  for (const l of listeners) l();
}

function attach() {
  if (attached || !window.visualViewport) return;
  attached = true;
  window.visualViewport.addEventListener("resize", measure);
  window.visualViewport.addEventListener("scroll", measure);
  measure();
}

/** Height of the on-screen keyboard in px (also mirrored to the CSS variable --kb and [data-keyboard]). */
export function useKeyboardInset() {
  return useSyncExternalStore(
    (onChange) => {
      attach();
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => inset,
    () => 0,
  );
}

export function startKeyboardTracking() {
  attach();
}
