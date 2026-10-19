import { TZDate } from "@date-fns/tz";
import { count, gte, isNull, lte, and } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { journalDays, mistakes, trades } from "@/lib/db/schema";
import type { ResolvedFilter } from "@/lib/filter";
import { dayKey, formatLongDate } from "@/lib/format";
import { monthBounds, type MonthKey } from "@/lib/calendar";
import { dayKeyStart, addDaysToKey } from "@/lib/dates";
import { computeMetrics, groupBy } from "@/lib/stats/metrics";
import {
  currencyScope,
  dailyPnl,
  equityCurve,
  loadClosedTrades,
  playbookNames,
  recentTrades,
  type StatRow,
} from "@/lib/stats/queries";
import type { CalendarDayData } from "@/components/calendar-month";

export function greeting(timeZone: string, now = Date.now()) {
  const hour = new TZDate(now, timeZone).getHours();
  const part = hour >= 5 && hour < 11 ? "Morgen" : hour >= 11 && hour < 18 ? "Tag" : "Abend";
  return { text: `Guten ${part}`, date: formatLongDate(now, timeZone), today: dayKey(now, timeZone) };
}

export function hasAnyTrades() {
  const [{ value }] = getDb().select({ value: count() }).from(trades).where(isNull(trades.deletedAt)).all();
  return value > 0;
}

/** Per-day P&L, trade counts and journal flags for one month (scope accounts only). */
export function calendarMonthData(month: MonthKey, timeZone: string, accountIds: string[], accountId: string | null) {
  const { from, to } = monthBounds(month);
  const start = dayKeyStart(from, timeZone);
  const end = dayKeyStart(addDaysToKey(to, 1), timeZone);
  const closed = loadClosedTrades({ start, end, accountId }, { accountIds });
  const days: Record<string, CalendarDayData> = {};
  for (const d of dailyPnl(closed, timeZone)) days[d.day] = { netPnl: d.netPnl, trades: d.trades, journal: false };
  const journal = getDb()
    .select({ date: journalDays.date })
    .from(journalDays)
    .where(and(gte(journalDays.date, from), lte(journalDays.date, to)))
    .all();
  for (const j of journal) days[j.date] = { ...(days[j.date] ?? { netPnl: 0, trades: 0 }), journal: true };
  return { days, closed };
}

export function topSetups(closed: StatRow[], limit = 3) {
  const names = new Map(playbookNames().map((p) => [p.id, p]));
  return [...groupBy(closed, (t) => t.playbookId).values()]
    .filter((g) => names.has(g.key))
    .sort((a, b) => b.totalR - a.totalR)
    .slice(0, limit)
    .map((g) => ({ ...g, name: names.get(g.key)!.name, color: names.get(g.key)!.color }));
}

/** Mistakes with the most negative total net P&L (trades carrying the mistake). */
export function topMistakes(closed: StatRow[], limit = 3) {
  const names = new Map(
    getDb()
      .select()
      .from(mistakes)
      .all()
      .map((m) => [m.id, m.name]),
  );
  const totals = new Map<string, { netPnl: number; trades: number }>();
  for (const t of closed) {
    for (const id of t.mistakeIds) {
      const entry = totals.get(id) ?? { netPnl: 0, trades: 0 };
      entry.netPnl += t.netPnl;
      entry.trades += 1;
      totals.set(id, entry);
    }
  }
  return [...totals.entries()]
    .filter(([id, v]) => names.has(id) && v.netPnl < 0)
    .sort((a, b) => a[1].netPnl - b[1].netPnl)
    .slice(0, limit)
    .map(([id, v]) => ({ id, name: names.get(id)!, ...v }));
}

export function dashboardData(filter: ResolvedFilter, baseCurrency: string, timeZone: string) {
  const scope = currencyScope(filter, baseCurrency);
  const ids = scope.accounts.map((a) => a.id);
  const closed = loadClosedTrades(filter, { accountIds: ids });
  const metrics = computeMetrics(closed);
  const previous =
    filter.prevStart != null && filter.prevEnd != null
      ? computeMetrics(
          loadClosedTrades(
            { start: filter.prevStart, end: filter.prevEnd, accountId: filter.accountId },
            { accountIds: ids },
          ),
        )
      : null;
  const curve = equityCurve(filter, ids, closed);
  return {
    scope,
    closed,
    metrics,
    previous,
    curve,
    daily: dailyPnl(closed, timeZone).slice(-30),
    recent: recentTrades(filter, 8),
    setups: topSetups(closed),
    mistakes: topMistakes(closed),
  };
}
