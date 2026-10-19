import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";

import { addDaysToKey, dayKeyStart } from "@/lib/dates";
import { getDb } from "@/lib/db/client";
import { listTrades, type TradeRow } from "@/lib/db/queries";
import { journalDays, screenshots } from "@/lib/db/schema";
import { dayKey } from "@/lib/format";

export type JournalListItem = {
  date: string;
  mood: number | null;
  firstLine: string;
  trades: number;
  pnl: { currency: string; value: number }[];
  hasEntry: boolean;
};

function firstLine(markdown: string) {
  const line = markdown
    .split("\n")
    .map((l) =>
      l
        .replace(/^[#>*\-\s[\]x]+/i, "")
        .replace(/[*_`]/g, "")
        .trim(),
    )
    .find((l) => l.length > 0);
  return line ?? "";
}

/** Days with a journal entry or closed trades, newest first. */
export function listJournalDays(timeZone: string): JournalListItem[] {
  const db = getDb();
  const entries = db.select().from(journalDays).orderBy(desc(journalDays.date)).all();
  const closed = listTrades({ start: null, end: null, accountId: null }).filter(
    (t) => t.status === "closed" && t.closedAt != null,
  );
  const map = new Map<string, JournalListItem>();
  for (const e of entries) {
    map.set(e.date, { date: e.date, mood: e.mood, firstLine: firstLine(e.review), trades: 0, pnl: [], hasEntry: true });
  }
  for (const t of closed) {
    const key = dayKey(t.closedAt as number, timeZone);
    const item = map.get(key) ?? { date: key, mood: null, firstLine: "", trades: 0, pnl: [], hasEntry: false };
    item.trades += 1;
    const bucket = item.pnl.find((p) => p.currency === t.currency);
    if (bucket) bucket.value += t.netPnl ?? 0;
    else item.pnl.push({ currency: t.currency, value: t.netPnl ?? 0 });
    map.set(key, item);
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Trades of a day: closed that day, or opened that day and still open. */
export function tradesOfDay(date: string, timeZone: string): TradeRow[] {
  const start = dayKeyStart(date, timeZone);
  const end = dayKeyStart(addDaysToKey(date, 1), timeZone);
  // Trades can be opened before the day they close; look back generously.
  const rows = listTrades({ start: start - 45 * 86_400_000, end, accountId: null });
  return rows
    .filter((t) => {
      const ts = t.status === "closed" && t.closedAt != null ? t.closedAt : t.openedAt;
      return ts >= start && ts < end;
    })
    .sort((a, b) => a.openedAt - b.openedAt);
}

export function getJournalDay(date: string) {
  const db = getDb();
  const entry = db.select().from(journalDays).where(eq(journalDays.date, date)).get() ?? null;
  const shots = db
    .select()
    .from(screenshots)
    .where(and(eq(screenshots.journalDate, date), isNull(screenshots.tradeId)))
    .orderBy(asc(screenshots.position))
    .all();
  return { entry, screenshots: shots };
}

export function journalDatesInRange(from: string, to: string) {
  return getDb()
    .select({ date: journalDays.date, mood: journalDays.mood, review: journalDays.review })
    .from(journalDays)
    .where(and(gte(journalDays.date, from), lt(journalDays.date, addDaysToKey(to, 1))))
    .all()
    .map((j) => ({ date: j.date, mood: j.mood, firstLine: firstLine(j.review) }));
}
