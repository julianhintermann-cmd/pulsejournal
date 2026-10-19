"use client";

import { useSyncExternalStore } from "react";

export const REDUCE_TRANSPARENCY_KEY = "pulse.reduceTransparency";
const QUERY = "(prefers-reduced-transparency: reduce)";
const listeners = new Set<() => void>();

function readSetting() {
  try {
    return localStorage.getItem(REDUCE_TRANSPARENCY_KEY) === "1";
  } catch {
    return false;
  }
}

function read() {
  return readSetting() || window.matchMedia(QUERY).matches;
}

/** Applies the in-app "Transparenz reduzieren" setting to <html data-reduce-transparency>. */
export function applyReducedTransparency() {
  document.documentElement.toggleAttribute("data-reduce-transparency", read());
}

export function setReducedTransparency(on: boolean) {
  try {
    if (on) localStorage.setItem(REDUCE_TRANSPARENCY_KEY, "1");
    else localStorage.removeItem(REDUCE_TRANSPARENCY_KEY);
  } catch {
    // storage unavailable: the setting just does not persist
  }
  applyReducedTransparency();
  for (const l of listeners) l();
}

/** True when glass should be solid (system setting or the in-app switch). */
export function useReducedTransparency() {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(QUERY);
      mql.addEventListener("change", onChange);
      listeners.add(onChange);
      return () => {
        mql.removeEventListener("change", onChange);
        listeners.delete(onChange);
      };
    },
    read,
    () => false,
  );
}

/** The in-app switch only (for the settings UI). */
export function useReducedTransparencySetting() {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    readSetting,
    () => false,
  );
}
