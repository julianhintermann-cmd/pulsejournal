import type { Metadata } from "next";

import { CalendarView } from "@/components/calendar/calendar-view";
import { monthBounds, parseMonthKey } from "@/lib/calendar";
import type { TradeRow } from "@/lib/db/queries";
import { listTrades } from "@/lib/db/queries";
import { addDaysToKey, dayKeyStart } from "@/lib/dates";
import { getFilter, type SearchParams } from "@/lib/filter-server";
import { dayKey } from "@/lib/format";
import { journalDatesInRange } from "@/lib/journal";
import { getSettings } from "@/lib/settings";
import { calendarMonthData } from "@/lib/stats/dashboard";
import { currencyScope } from "@/lib/stats/queries";

export const metadata: Metadata = { title: "Kalender" };

function todayKey(timeZone: string) {
  return dayKey(Date.now(), timeZone);
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const settings = getSettings();
  const tz = settings.displayTimezone;
  const today = todayKey(tz);
  const monthParam = typeof params.month === "string" ? params.month : undefined;
  const month = parseMonthKey(monthParam) ?? parseMonthKey(today.slice(0, 7))!;
  const filter = await getFilter(params);
  const scope = currencyScope(filter, settings.baseCurrency);
  const ids = scope.accounts.map((a) => a.id);
  const { days } = calendarMonthData(month, tz, ids, filter.accountId);

  const { from, to } = monthBounds(month);
  const start = dayKeyStart(from, tz);
  const end = dayKeyStart(addDaysToKey(to, 1), tz);
  const tradesByDay: Record<string, TradeRow[]> = {};
  for (const t of listTrades({ start: start - 45 * 86_400_000, end, accountId: filter.accountId })) {
    if (!ids.includes(t.accountId)) continue;
    const ts = t.status === "closed" && t.closedAt != null ? t.closedAt : t.openedAt;
    if (ts < start || ts >= end) continue;
    const key = dayKey(ts, tz);
    (tradesByDay[key] ??= []).push(t);
  }
  const journal = Object.fromEntries(
    journalDatesInRange(from, to).map((j) => [j.date, { mood: j.mood, firstLine: j.firstLine }]),
  );

  return (
    <CalendarView
      month={month}
      days={days}
      trades={tradesByDay}
      journal={journal}
      today={today}
      currency={scope.currency}
    />
  );
}
