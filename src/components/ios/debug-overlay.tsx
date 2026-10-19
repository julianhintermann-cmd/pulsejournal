"use client";

import { useEffect, useRef, useState } from "react";

/** Glass budget from the brief: never more than this many visible backdrop-filter layers. */
export const BACKDROP_BUDGET = 5;

type Stats = {
  fps: number;
  slowFrames: number;
  backdrops: number;
  safe: string;
  kb: string;
  dt: string;
  viewport: string;
  flags: string[];
};

function countBackdrops() {
  let n = 0;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
    if (el.closest("[data-ios-debug]")) continue;
    const style = getComputedStyle(el);
    const filter =
      style.backdropFilter || (style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter;
    if (!filter || filter === "none") continue;
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (
      rect.width === 0 ||
      rect.height === 0 ||
      rect.bottom <= 0 ||
      rect.right <= 0 ||
      rect.top >= vh ||
      rect.left >= vw
    )
      continue;
    n++;
  }
  return n;
}

function readFlags() {
  const html = document.documentElement;
  const mq = (q: string) => window.matchMedia(q).matches;
  return [
    html.hasAttribute("data-standalone") ? "standalone" : "browser",
    mq("(prefers-color-scheme: dark)") ? "dark" : "light",
    mq("(prefers-reduced-motion: reduce)") && "reduced-motion",
    html.hasAttribute("data-reduce-transparency") && "reduced-transparency",
    mq("(prefers-contrast: more)") && "increased-contrast",
    html.hasAttribute("data-keyboard") && "keyboard",
    html.hasAttribute("data-presented") && "presented",
  ].filter((f): f is string => Boolean(f));
}

/**
 * `?debug=1` overlay (section 0.7): FPS and slow frames, safe-area insets (dashed guides), keyboard inset `--kb`,
 * Dynamic Type `--dt`, visible backdrop-filter layers against the budget and the accessibility flags. Turned off
 * with `?debug=0`. Never rendered unless asked for.
 */
export function DebugOverlay() {
  const probe = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let frames = 0;
    let slow = 0;
    let last = performance.now();
    let windowStart = last;
    let raf = 0;
    const tick = (now: number) => {
      frames++;
      if (now - last > 20) slow++;
      last = now;
      if (now - windowStart >= 500) {
        const fps = Math.round((frames * 1000) / (now - windowStart));
        const p = probe.current ? getComputedStyle(probe.current) : null;
        const root = getComputedStyle(document.documentElement);
        setStats({
          fps,
          slowFrames: slow,
          backdrops: countBackdrops(),
          safe: p
            ? [p.paddingTop, p.paddingRight, p.paddingBottom, p.paddingLeft].map((v) => parseInt(v, 10)).join(" ")
            : "–",
          kb: root.getPropertyValue("--kb").trim() || "0px",
          dt: root.getPropertyValue("--dt").trim() || "1",
          viewport: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
          flags: readFlags(),
        });
        frames = 0;
        slow = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const overBudget = (stats?.backdrops ?? 0) > BACKDROP_BUDGET;
  return (
    <div data-ios-debug aria-hidden="true" className="ios-debug">
      <div ref={probe} className="ios-debug__safe" />
      {stats ? (
        <dl className="ios-debug__panel" data-backdrops={stats.backdrops} data-fps={stats.fps}>
          <dt>FPS</dt>
          <dd className={stats.fps < 50 ? "ios-debug__bad" : undefined}>
            {stats.fps} · {stats.slowFrames} slow
          </dd>
          <dt>Glass</dt>
          <dd className={overBudget ? "ios-debug__bad" : undefined}>
            {stats.backdrops}/{BACKDROP_BUDGET}
          </dd>
          <dt>Safe</dt>
          <dd>{stats.safe}</dd>
          <dt>--kb</dt>
          <dd>{stats.kb}</dd>
          <dt>--dt</dt>
          <dd>{stats.dt}</dd>
          <dt>View</dt>
          <dd>{stats.viewport}</dd>
          <dd className="ios-debug__flags">{stats.flags.join(" · ")}</dd>
        </dl>
      ) : null}
    </div>
  );
}
