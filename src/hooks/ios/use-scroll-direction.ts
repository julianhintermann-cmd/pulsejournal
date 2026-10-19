"use client";

import { useEffect, useState } from "react";

/**
 * Document scroll state for the iOS chrome: `scrolled` once content moved under the bars, `collapsed` after
 * scrolling down more than `threshold` px; it expands again after a real scroll up (16 px) or near the top. The
 * rubber band at either end never toggles it, and it only re-renders when one of the two flags changes.
 */
export function useScrollDirection(threshold = 40) {
  const [state, setState] = useState({ scrolled: false, collapsed: false });
  useEffect(() => {
    let last = window.scrollY;
    let low = last; // lowest point of the current downward run
    let high = last; // highest point since the last downward move
    let frame = 0;
    const update = () => {
      frame = 0;
      const raw = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = Math.min(Math.max(0, raw), Math.max(0, max));
      let collapsed: boolean | null = null;
      // Programmatic jumps (scroll restore after a tab switch) are not a gesture: keep the current state.
      if (Math.abs(y - last) > 400) {
        last = low = high = y;
        return;
      }
      const overscroll = raw < 0 || raw > max;
      if (y < 8) collapsed = false;
      else if (!overscroll) {
        if (y > last) {
          high = y;
          if (y - low > threshold) collapsed = true;
        } else if (y < last) {
          low = y;
          if (high - y > 16) collapsed = false;
        }
      }
      last = y;
      setState((prev) => {
        const next = { scrolled: y > 4, collapsed: collapsed ?? prev.collapsed };
        return next.scrolled === prev.scrolled && next.collapsed === prev.collapsed ? prev : next;
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold]);
  return state;
}
