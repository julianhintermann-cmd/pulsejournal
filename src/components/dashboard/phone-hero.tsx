"use client";

import { useState } from "react";

import { todayKey, useApplyFilter, useFilterState } from "@/components/global-filter";
import { NumberRoll, SegmentedControl } from "@/components/ios/controls";
import { ScrubChart, type ScrubPoint } from "@/components/ios/scrub-chart";
import type { FilterState } from "@/lib/filter";
import { formatDateTime, formatMoney, formatPercent, NBSP } from "@/lib/format";
import { cn } from "@/lib/utils";

type Preset = "1W" | "1M" | "3M" | "YTD" | "1J" | "ALL";

function shiftDay(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftMonths(key: string, months: number) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1 + months, d + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Stocks-style range presets mapped onto the global filter (rolling windows are custom ranges ending today). */
function presetState(preset: Preset, state: FilterState): FilterState {
  const today = todayKey();
  switch (preset) {
    case "1W":
      return { ...state, range: "custom", from: shiftDay(today, -6), to: today };
    case "1M":
      return { ...state, range: "30d", from: null, to: null };
    case "3M":
      return { ...state, range: "custom", from: shiftMonths(today, -3), to: today };
    case "YTD":
      return { ...state, range: "year", from: null, to: null };
    case "1J":
      return { ...state, range: "custom", from: shiftMonths(today, -12), to: today };
    case "ALL":
      return { ...state, range: "all", from: null, to: null };
  }
}

function currentPreset(state: FilterState): Preset | null {
  if (state.range === "30d") return "1M";
  if (state.range === "year") return "YTD";
  if (state.range === "all") return "ALL";
  if (state.range === "custom") {
    for (const preset of ["1W", "3M", "1J"] as const) {
      const p = presetState(preset, state);
      if (p.from === state.from && p.to === state.to) return preset;
    }
  }
  return null;
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "YTD", label: "YTD" },
  { value: "1J", label: "1J" },
  { value: "ALL", label: "Alles" },
];

function Money({ value, currency }: { value: number; currency: string }) {
  const text = formatMoney(value, currency, { signed: true, decimals: Math.abs(value) >= 10_000 ? 0 : 2 });
  const [prefix, amount] = text.split(NBSP);
  const sign = prefix.slice(0, prefix.length - currency.length);
  return (
    <span className="inline-flex items-baseline">
      <span>{sign}</span>
      <span className="mr-[0.2em] text-[0.55em] font-semibold">{currency}</span>
      <NumberRoll value={amount} />
    </span>
  );
}

/**
 * Übersicht hero on phones (section 7.1): period net P&L with change chip, the equity curve full-bleed with
 * scrubbing (hero number and date follow the finger), range presets synced with the global filter.
 */
export function PhoneHero({
  netPnl,
  currency,
  periodLabel,
  points,
  startBalance,
  timeZone,
}: {
  netPnl: number;
  currency: string;
  periodLabel: string;
  /** Cumulative trade P&L of the period. */
  points: ScrubPoint[];
  startBalance: number | null;
  timeZone: string;
}) {
  const state = useFilterState();
  const apply = useApplyFilter();
  const [scrub, setScrub] = useState<number | null>(null);
  const shown = scrub != null ? points[scrub] : null;
  const value = shown ? shown.value : netPnl;
  const up = value >= 0;
  const color = up ? "var(--profit)" : "var(--loss)";
  const change = startBalance ? value / startBalance : null;

  return (
    <section className="relative isolate -mx-[var(--ios-margin)] mb-2 md:hidden">
      <div
        aria-hidden="true"
        className="ios-hero-glow"
        style={{ background: `radial-gradient(60% 60% at 30% 30%, ${color}, transparent 70%)` }}
      />
      <div className="px-[var(--ios-margin)]">
        <p className="text-[15px] text-muted-foreground">
          Netto P&L · {shown ? formatDateTime(shown.ts, timeZone) : periodLabel}
        </p>
        <p className={cn("mt-0.5 text-[34px] leading-[1.15] font-bold tabular-nums", up ? "text-profit" : "text-loss")}>
          <Money value={value} currency={currency} />
        </p>
        {change != null ? (
          <span
            className={cn(
              "mt-1 inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold tabular-nums",
              up ? "bg-profit-soft text-profit" : "bg-loss-soft text-loss",
            )}
          >
            {formatPercent(change, { signed: true, decimals: 2 })}
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        {points.length > 1 ? (
          <ScrubChart
            points={points}
            color={color}
            height={190}
            onScrub={setScrub}
            label={`Equity-Kurve ${periodLabel}, Netto P&L ${formatMoney(netPnl, currency, { signed: true })}`}
          />
        ) : (
          <p className="flex h-[120px] items-center justify-center text-[15px] text-muted-foreground">
            Keine abgeschlossenen Trades im Zeitraum.
          </p>
        )}
      </div>
      <div className="mt-3 px-[var(--ios-margin)]">
        <SegmentedControl
          label="Zeitraum"
          value={currentPreset(state)}
          options={PRESETS}
          onChange={(preset) => apply(presetState(preset, state))}
        />
      </div>
    </section>
  );
}
