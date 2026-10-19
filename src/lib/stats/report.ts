import { TZDate } from "@date-fns/tz";

import { getDb } from "@/lib/db/client";
import { mistakes } from "@/lib/db/schema";
export { MIN_BUCKET_TRADES } from "@/lib/stats/constants";
import { SESSION_LABELS, SESSION_ORDER } from "@/lib/sessions";
import {
  computeMetrics,
  groupBy,
  HOLD_BUCKETS,
  holdBucketIndex,
  maxDrawdown,
  rHistogram,
  underwater,
  type GroupSummary,
} from "@/lib/stats/metrics";
import type { EquityPoint, StatRow } from "@/lib/stats/queries";
import { playbookNames } from "@/lib/stats/queries";

export type GroupRow = GroupSummary & { label: string; color?: string };

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function weekdayIndex(ts: number, timeZone: string) {
  // 0 = Monday … 6 = Sunday
  return (new TZDate(ts, timeZone).getDay() + 6) % 7;
}

function hourOf(ts: number, timeZone: string) {
  return new TZDate(ts, timeZone).getHours();
}

/** Turns a group map into rows in a fixed order (missing keys become empty rows when `fill` is set). */
function rows(
  groups: Map<string, GroupSummary>,
  order: { key: string; label: string; color?: string }[],
  fill = false,
): GroupRow[] {
  return order.flatMap((o) => {
    const g = groups.get(o.key);
    if (!g && !fill) return [];
    return [
      {
        ...(g ?? {
          key: o.key,
          trades: 0,
          netPnl: 0,
          winRate: null,
          profitFactor: null,
          expectancyR: null,
          totalR: 0,
          rulesFollowed: null,
          wins: 0,
          losses: 0,
        }),
        label: o.label,
        color: o.color,
      },
    ];
  });
}

export function buildReport(closed: StatRow[], curve: EquityPoint[], timeZone: string) {
  const metrics = computeMetrics(closed);
  const drawdown = maxDrawdown(curve);

  // Setups
  const names = playbookNames();
  const setupGroups = groupBy(closed, (t) => t.playbookId ?? "none");
  const setups = rows(setupGroups, [
    ...names.map((p) => ({ key: p.id, label: p.name, color: p.color })),
    { key: "none", label: "Ohne Setup", color: "#9AA3B5" },
  ]).sort((a, b) => b.totalR - a.totalR);

  // Time
  const byWeekday = rows(
    groupBy(closed, (t) => String(weekdayIndex(t.openedAt, timeZone))),
    WEEKDAYS.map((label, i) => ({ key: String(i), label })),
    true,
  );
  const byHour = rows(
    groupBy(closed, (t) => String(hourOf(t.openedAt, timeZone))),
    Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: `${String(h).padStart(2, "0")}` })),
    true,
  );
  const bySession = rows(
    groupBy(closed, (t) => t.session),
    SESSION_ORDER.map((s) => ({ key: s, label: SESSION_LABELS[s] })),
    true,
  );
  const byHold = rows(
    groupBy(closed, (t) => (t.holdMinutes == null ? null : String(holdBucketIndex(t.holdMinutes)))),
    HOLD_BUCKETS.map((label, i) => ({ key: String(i), label })),
    true,
  );

  // Symbols
  const symbolKeys = Array.from(new Set(closed.map((t) => t.symbol))).sort();
  const symbols = rows(
    groupBy(closed, (t) => t.symbol),
    symbolKeys.map((s) => ({ key: s, label: s })),
  ).sort((a, b) => b.netPnl - a.netPnl);
  const longShort = rows(
    groupBy(closed, (t) => t.direction),
    [
      { key: "long", label: "Long" },
      { key: "short", label: "Short" },
    ],
    true,
  );

  // Psychology
  const emotionKeys = Array.from(new Set(closed.map((t) => t.emotionBefore).filter((e): e is string => !!e))).sort();
  const byEmotion = rows(
    groupBy(closed, (t) => t.emotionBefore),
    emotionKeys.map((e) => ({ key: e, label: e })),
  ).sort((a, b) => b.netPnl - a.netPnl);
  const mistakeNames = new Map(
    getDb()
      .select()
      .from(mistakes)
      .all()
      .map((m) => [m.id, m.name]),
  );
  const mistakeTotals = new Map<string, { netPnl: number; trades: number }>();
  for (const t of closed) {
    for (const id of t.mistakeIds) {
      const e = mistakeTotals.get(id) ?? { netPnl: 0, trades: 0 };
      e.netPnl += t.netPnl;
      e.trades += 1;
      mistakeTotals.set(id, e);
    }
  }
  const mistakeCosts = [...mistakeTotals.entries()]
    .filter(([id]) => mistakeNames.has(id))
    .map(([id, v]) => ({ id, label: mistakeNames.get(id)!, ...v }))
    .sort((a, b) => a.netPnl - b.netPnl);
  const scale = Array.from({ length: 5 }, (_, i) => ({ key: String(i + 1), label: String(i + 1) }));
  const byConfidence = rows(
    groupBy(closed, (t) => (t.confidence == null ? null : String(t.confidence))),
    scale,
    true,
  );
  const byExecution = rows(
    groupBy(closed, (t) => (t.executionRating == null ? null : String(t.executionRating))),
    scale,
    true,
  );

  // R distribution
  const histogram = rHistogram(closed.map((t) => t.rMultiple).filter((r): r is number => r != null));

  return {
    metrics,
    drawdown,
    underwater: underwater(curve),
    setups,
    byWeekday,
    byHour,
    bySession,
    byHold,
    symbols,
    longShort,
    byEmotion,
    mistakeCosts,
    byConfidence,
    byExecution,
    histogram,
  };
}

export type Report = ReturnType<typeof buildReport>;
