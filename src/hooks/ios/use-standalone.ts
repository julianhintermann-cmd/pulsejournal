"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(display-mode: standalone)";

function read() {
  return window.matchMedia(QUERY).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** True when the app runs from the home screen (no Safari UI). */
export function useStandalone() {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(QUERY);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    read,
    () => false,
  );
}
