"use client";

import { useEffect, useState } from "react";

/**
 * Document scroll state for the iOS chrome: `scrolled` once content moved under the bars, `collapsed` after
 * scrolling down more than `threshold` px (reset when scrolling up or near the top).
 */
export function useScrollDirection(threshold = 40) {
  const [state, setState] = useState({ scrolled: false, collapsed: false, y: 0 });
  useEffect(() => {
    let last = window.scrollY;
    let anchor = last;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      let collapsed: boolean | null = null;
      if (y < 8) collapsed = false;
      else if (y > last) {
        if (y - anchor > threshold && y < max - 4) collapsed = true;
      } else if (y < last - 2) {
        anchor = y;
        collapsed = false;
      }
      if (y > last) anchor = Math.min(anchor, last);
      last = y;
      setState((prev) => {
        const next = { scrolled: y > 4, collapsed: collapsed ?? prev.collapsed, y };
        return next.scrolled === prev.scrolled && next.collapsed === prev.collapsed && Math.abs(next.y - prev.y) < 1
          ? prev
          : next;
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
