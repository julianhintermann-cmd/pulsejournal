"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { formatMoney, formatNumber, formatPercent, formatR, formatRatio, NBSP } from "@/lib/format";
import { cn } from "@/lib/utils";

export type KpiFormat = { kind: "money"; currency: string } | { kind: "percent" } | { kind: "ratio" } | { kind: "r" };

/** Renders the KPI value; `final` (the target value) decides the decimals so the count-up does not jitter. */
function format(value: number | null, f: KpiFormat, final: number | null): React.ReactNode {
  if (value == null) return "n/a";
  switch (f.kind) {
    case "money": {
      // Large amounts drop the cents and the currency code is set smaller so the value fits two phone columns.
      const decimals = Math.abs(final ?? value) >= 1000 ? 0 : 2;
      const text = formatMoney(value, f.currency, { signed: true, decimals });
      const [prefix, amount] = text.split(NBSP);
      const sign = prefix.slice(0, prefix.length - f.currency.length);
      return (
        <>
          {sign}
          <span className="mr-[0.18em] text-[0.62em] font-semibold tracking-normal">{f.currency}</span>
          {amount}
        </>
      );
    }
    case "percent":
      return formatPercent(value);
    case "ratio":
      return formatRatio(value);
    case "r":
      return formatR(value);
  }
}

function formatDelta(delta: number, f: KpiFormat) {
  switch (f.kind) {
    case "money":
      return formatMoney(delta, f.currency, { signed: true, decimals: Math.abs(delta) >= 1000 ? 0 : 2 });
    case "percent":
      return `${formatNumber(delta * 100, 1, { signed: true })} pp`;
    case "ratio":
      return formatNumber(delta, 2, { signed: true });
    case "r":
      return formatR(delta);
  }
}

const ANIMATED_KEY = "pulse.kpiAnimated";

/** Animates a number from 0 to its value once per browser session (600 ms, respects reduced motion). */
function useCountUp(value: number | null) {
  const [animated, setAnimated] = useState<number | null>(null);
  const raf = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (value == null || !Number.isFinite(value)) return;
    let animate = false;
    try {
      animate =
        sessionStorage.getItem(ANIMATED_KEY) !== "1" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(() => sessionStorage.setItem(ANIMATED_KEY, "1"), 700);
    } catch {
      animate = false;
    }
    if (!animate) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(t < 1 ? value * eased : null);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value]);

  return animated ?? value;
}

export function KpiCard({
  label,
  value,
  format: fmt,
  sub,
  delta,
  higherIsBetter = true,
  chart,
  className,
}: {
  label: string;
  value: number | null;
  format: KpiFormat;
  sub?: React.ReactNode;
  /** Change vs. the previous equal-length period (null hides the chip). */
  delta?: number | null;
  higherIsBetter?: boolean;
  chart?: React.ReactNode;
  className?: string;
}) {
  const display = useCountUp(value === Number.POSITIVE_INFINITY ? null : value);
  const shown = value === Number.POSITIVE_INFINITY ? "∞" : format(display, fmt, value);
  const tone =
    fmt.kind === "money" && value != null && Math.round(value * 100) !== 0
      ? value > 0
        ? "text-profit"
        : "text-loss"
      : "text-foreground";
  const deltaGood = delta != null && delta !== 0 ? delta > 0 === higherIsBetter : null;
  const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className={cn(
        "card relative flex min-h-[132px] flex-col overflow-hidden transition-colors md:hover:border-surface-3",
        className,
      )}
    >
      <div className="flex flex-1 flex-col gap-1 p-4 md:p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-small tracking-[0.04em] text-muted-foreground uppercase">{label}</span>
          {delta != null && Number.isFinite(delta) ? (
            <span
              className={cn(
                "inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                deltaGood == null
                  ? "bg-surface-2 text-muted-foreground"
                  : deltaGood
                    ? "bg-profit-soft text-profit"
                    : "bg-loss-soft text-loss",
              )}
              title="Veränderung zur Vorperiode"
            >
              <DeltaIcon className="size-3" strokeWidth={2.5} />
              <span className="hidden sm:inline">{formatDelta(delta, fmt)}</span>
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            "truncate text-kpi-sm whitespace-nowrap tabular-nums max-[359px]:text-[20px] max-[359px]:leading-[26px] md:text-kpi",
            tone,
          )}
        >
          {shown}
        </span>
        {sub ? <span className="text-small text-muted-foreground">{sub}</span> : null}
      </div>
      {chart ? <div className="-mt-1">{chart}</div> : null}
    </div>
  );
}

/** Win / loss / break-even donut. */
export function WinLossDonut({
  wins,
  losses,
  breakEven,
  size = 44,
}: {
  wins: number;
  losses: number;
  breakEven: number;
  size?: number;
}) {
  const total = wins + losses + breakEven;
  const r = 15.9155; // circumference = 100
  const segments =
    total === 0
      ? []
      : [
          { value: (wins / total) * 100, color: "var(--profit)" },
          { value: (losses / total) * 100, color: "var(--loss)" },
          { value: (breakEven / total) * 100, color: "var(--be)" },
        ];
  let offset = 25;
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden="true" className="shrink-0 -rotate-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="4" />
      {segments.map((s, i) => {
        const el = (
          <circle
            key={i}
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="4"
            strokeDasharray={`${s.value} ${100 - s.value}`}
            strokeDashoffset={offset}
          />
        );
        offset -= s.value;
        return el;
      })}
    </svg>
  );
}
