"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentProps, type ComponentType } from "react";

import { Skeleton } from "@/components/ui/skeleton";

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };

let pageLoaded = false;
const queue: (() => void)[] = [];
let draining = false;

function nextIdle(cb: () => void) {
  const idle = (window as IdleWindow).requestIdleCallback;
  if (idle) idle(cb, { timeout: 1500 });
  else window.setTimeout(cb, 120);
}

/** Releases one waiting chart per idle period, so several charts never render in one long task. */
function drain() {
  if (draining) return;
  draining = true;
  const step = () => {
    const next = queue.shift();
    if (!next) {
      draining = false;
      return;
    }
    next();
    nextIdle(step);
  };
  nextIdle(step);
}

/** Resolves once the page has loaded and it is this chart's turn in the idle queue. */
function useIdleTurn(enabled: boolean) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled || ready) return;
    let cancelled = false;
    const release = () => {
      if (!cancelled) setReady(true);
    };
    const enqueue = () => {
      pageLoaded = true;
      queue.push(release);
      drain();
    };
    if (pageLoaded || document.readyState === "complete") enqueue();
    else window.addEventListener("load", enqueue, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", enqueue);
      const index = queue.indexOf(release);
      if (index >= 0) queue.splice(index, 1);
    };
  }, [enabled, ready]);
  return ready;
}

/**
 * Recharts is loaded after the page is interactive and idle. The placeholders reserve the exact chart height,
 * so there is no layout shift when the chart appears.
 */
function deferred<P extends { height?: number }>(load: () => Promise<ComponentType<P>>, defaultHeight: number) {
  const Lazy = dynamic(load, {
    ssr: false,
    loading: () => <Skeleton className="w-full" style={{ height: defaultHeight }} />,
  }) as ComponentType<P>;
  function DeferredChart(props: P) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    const ready = useIdleTurn(visible);
    useEffect(() => {
      const el = ref.current;
      if (!el || visible) return;
      // Charts far below the fold are rendered when they come close to the viewport.
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setVisible(true);
            observer.disconnect();
          }
        },
        { rootMargin: "300px 0px" },
      );
      observer.observe(el);
      return () => observer.disconnect();
    }, [visible]);
    if (!ready) {
      return <Skeleton ref={ref} className="w-full" style={{ height: props.height ?? defaultHeight }} />;
    }
    return <Lazy {...props} />;
  }
  return DeferredChart;
}

export const EquityChart = deferred<ComponentProps<typeof import("@/components/charts/equity-chart").EquityChart>>(
  () => import("@/components/charts/equity-chart").then((m) => m.EquityChart),
  260,
);

export const DailyPnlChart = deferred<
  ComponentProps<typeof import("@/components/charts/daily-pnl-chart").DailyPnlChart>
>(() => import("@/components/charts/daily-pnl-chart").then((m) => m.DailyPnlChart), 200);

export const DrawdownChart = deferred<
  ComponentProps<typeof import("@/components/charts/drawdown-chart").DrawdownChart>
>(() => import("@/components/charts/drawdown-chart").then((m) => m.DrawdownChart), 180);

export const Histogram = deferred<ComponentProps<typeof import("@/components/charts/histogram").Histogram>>(
  () => import("@/components/charts/histogram").then((m) => m.Histogram),
  300,
);

export const BarListChart = deferred<ComponentProps<typeof import("@/components/charts/bar-list-chart").BarListChart>>(
  () => import("@/components/charts/bar-list-chart").then((m) => m.BarListChart),
  220,
);
