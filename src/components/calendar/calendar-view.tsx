"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, type PanInfo } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useApp } from "@/components/app-context";
import { CalendarMonth, type CalendarDayData } from "@/components/calendar-month";
import { PnlValue } from "@/components/pnl-value";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { TradeCard } from "@/components/trades/trade-card";
import { Button } from "@/components/ui/button";
import { monthKeyString, shiftMonth, type MonthKey } from "@/lib/calendar";
import type { TradeRow } from "@/lib/db/queries";
import { formatDayKey, formatPercent, plural } from "@/lib/format";
import { MOOD_EMOJI } from "@/lib/labels";

export function CalendarView({
  month,
  days,
  trades,
  journal,
  today,
  currency,
}: {
  month: MonthKey;
  days: Record<string, CalendarDayData>;
  trades: Record<string, TradeRow[]>;
  journal: Record<string, { mood: number | null; firstLine: string }>;
  today: string;
  currency: string;
}) {
  const router = useRouter();
  const { weekStartsOn, timeZone } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const prev = monthKeyString(shiftMonth(month, -1));
  const next = monthKeyString(shiftMonth(month, 1));
  const values = Object.values(days).filter((d) => d.trades > 0);
  const total = values.reduce((a, d) => a + d.netPnl, 0);
  const tradeCount = values.reduce((a, d) => a + d.trades, 0);
  const greenDays = values.filter((d) => d.netPnl > 0).length;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < 80 || Math.abs(info.offset.y) > Math.abs(info.offset.x)) return;
    router.push(`/calendar?month=${info.offset.x < 0 ? next : prev}`);
  };

  const dayTrades = selected ? (trades[selected] ?? []) : [];
  const dayJournal = selected ? journal[selected] : undefined;
  const daySums = new Map<string, number>();
  for (const t of dayTrades)
    if (t.netPnl != null && t.status === "closed") daySums.set(t.currency, (daySums.get(t.currency) ?? 0) + t.netPnl);

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="card flex flex-col gap-4 p-3 md:p-5">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Vorheriger Monat">
            <Link href={`/calendar?month=${prev}`} scroll={false}>
              <ChevronLeft />
            </Link>
          </Button>
          <div className="flex flex-1 flex-col items-center">
            <h2 className="text-h2">{formatDayKey(`${monthKeyString(month)}-01`, "MMMM yyyy")}</h2>
            <p className="flex flex-wrap items-center justify-center gap-x-2 text-small text-muted-foreground">
              {tradeCount > 0 ? <PnlValue value={total} currency={currency} className="font-semibold" /> : null}
              <span>{plural(tradeCount, "Trade", "Trades")}</span>
              {values.length > 0 ? <span>· {formatPercent(greenDays / values.length)} grüne Tage</span> : null}
            </p>
          </div>
          <Button asChild variant="ghost" size="icon" aria-label="Nächster Monat">
            <Link href={`/calendar?month=${next}`} scroll={false}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          dragSnapToOrigin
          onDragEnd={onDragEnd}
          className="touch-pan-y md:touch-auto"
        >
          <CalendarMonth
            month={month}
            days={days}
            weekStartsOn={weekStartsOn}
            today={today}
            currency={currency}
            onSelect={setSelected}
          />
        </motion.div>
        {monthKeyString(month) !== today.slice(0, 7) ? (
          <div className="flex justify-center">
            <Button asChild variant="secondary" size="sm">
              <Link href="/calendar">Heute</Link>
            </Button>
          </div>
        ) : null}
      </div>

      <ResponsiveDialog
        open={selected != null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected ? formatDayKey(selected, "EEEE, d. MMMM yyyy") : ""}
        description={selected ? plural(dayTrades.length, "Trade", "Trades") : undefined}
        footer={
          selected ? (
            <Button asChild>
              <Link href={`/journal/${selected}`}>Tag öffnen</Link>
            </Button>
          ) : null
        }
      >
        <div className="flex flex-col gap-4 pb-1">
          {daySums.size > 0 ? (
            <div className="flex flex-wrap gap-3">
              {[...daySums.entries()].map(([c, v]) => (
                <PnlValue key={c} value={v} currency={c} className="text-h2" />
              ))}
            </div>
          ) : null}
          {dayTrades.length > 0 ? (
            <ul className="-mx-4 divide-y divide-border border-y border-border md:mx-0 md:rounded-[12px] md:border">
              {dayTrades.map((t) => (
                <li key={t.id}>
                  <TradeCard trade={t} timeZone={timeZone} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body text-muted-foreground">Keine Trades an diesem Tag.</p>
          )}
          <div className="rounded-[12px] bg-surface-2 p-3">
            <p className="mb-1 text-small tracking-[0.04em] text-muted-foreground uppercase">Journal</p>
            {dayJournal ? (
              <p className="flex items-start gap-2 text-body">
                {dayJournal.mood ? <span aria-hidden="true">{MOOD_EMOJI[dayJournal.mood - 1]}</span> : null}
                <span className="line-clamp-3">{dayJournal.firstLine || "Kein Review geschrieben."}</span>
              </p>
            ) : (
              <p className="text-body text-muted-foreground">Noch kein Eintrag für diesen Tag.</p>
            )}
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
