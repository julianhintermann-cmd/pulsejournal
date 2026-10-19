"use client";

import dynamic from "next/dynamic";
import { useEffect, useSyncExternalStore } from "react";

import { startKeyboardTracking } from "@/hooks/ios/use-keyboard-inset";
import { applyReducedTransparency, REDUCE_TRANSPARENCY_KEY } from "@/hooks/ios/use-reduced-transparency";

const DebugOverlay = dynamic(() => import("./debug-overlay").then((m) => m.DebugOverlay), { ssr: false });
const DEBUG_KEY = "pulse.debug";

/** `?debug=1` turns the overlay on for this tab (survives client navigation), `?debug=0` turns it off. */
function readDebug() {
  const param = new URLSearchParams(window.location.search).get("debug");
  try {
    if (param === "1") sessionStorage.setItem(DEBUG_KEY, "1");
    if (param === "0") sessionStorage.removeItem(DEBUG_KEY);
    return sessionStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return param === "1";
  }
}
const noSubscribe = () => () => undefined;

const FIELD = "input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Document-level iOS behaviour that has no visual output: keyboard inset (--kb), standalone flag, pinch-zoom lock
 * for the home-screen app (except inside [data-allow-zoom], e.g. the screenshot lightbox), reduced transparency and
 * keeping the focused field above the keyboard. Renders only the `?debug=1` overlay.
 */
export function IosRuntime() {
  const debug = useSyncExternalStore(noSubscribe, readDebug, () => false);
  useEffect(() => {
    startKeyboardTracking();
    applyReducedTransparency();
    const html = document.documentElement;

    // Phones restore scroll positions themselves (stack pops, tab switches). The browser's own restore runs at an
    // engine-specific moment after a back navigation (in Safari after ours, with the position from before the push
    // reset it) and would win, so it is off below 768 px. Tablets and desktop keep the browser default.
    const phoneQuery = window.matchMedia("(max-width: 767px)");
    const syncScrollRestoration = () => {
      history.scrollRestoration = phoneQuery.matches ? "manual" : "auto";
    };
    syncScrollRestoration();
    phoneQuery.addEventListener("change", syncScrollRestoration);

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const syncStandalone = () => html.toggleAttribute("data-standalone", isStandalone());
    syncStandalone();
    standaloneQuery.addEventListener("change", syncStandalone);

    const preventZoom = (event: Event) => {
      if (!html.hasAttribute("data-standalone")) return;
      if ((event.target as Element | null)?.closest?.("[data-allow-zoom]")) return;
      event.preventDefault();
    };
    document.addEventListener("gesturestart", preventZoom, { passive: false });
    document.addEventListener("gesturechange", preventZoom, { passive: false });

    // iOS Safari only applies :active press states when the document has a touch listener.
    const noop = () => undefined;
    document.addEventListener("touchstart", noop, { passive: true });

    const onStorage = (event: StorageEvent) => {
      if (event.key === REDUCE_TRANSPARENCY_KEY) applyReducedTransparency();
    };
    window.addEventListener("storage", onStorage);

    // Keep the focused field 16 px above the keyboard (Safari does this for the page, not for fixed sheets).
    let timer = 0;
    const keepVisible = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const el = document.activeElement as HTMLElement | null;
        const vv = window.visualViewport;
        if (!el || !vv || !el.matches?.(FIELD)) return;
        const rect = el.getBoundingClientRect();
        if (rect.bottom > vv.height - 16 || rect.top < 16) el.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 120);
    };
    window.visualViewport?.addEventListener("resize", keepVisible);
    document.addEventListener("focusin", keepVisible);

    return () => {
      phoneQuery.removeEventListener("change", syncScrollRestoration);
      standaloneQuery.removeEventListener("change", syncStandalone);
      document.removeEventListener("gesturestart", preventZoom);
      document.removeEventListener("gesturechange", preventZoom);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("touchstart", noop);
      window.visualViewport?.removeEventListener("resize", keepVisible);
      document.removeEventListener("focusin", keepVisible);
      window.clearTimeout(timer);
    };
  }, []);
  return debug ? <DebugOverlay /> : null;
}
