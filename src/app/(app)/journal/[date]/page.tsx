import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { JournalDayEditor } from "@/components/journal/journal-day-editor";
import { JournalScreenshots } from "@/components/journal/journal-screenshots";
import { PnlValue } from "@/components/pnl-value";
import { TradeCard } from "@/components/trades/trade-card";
import { Button } from "@/components/ui/button";
import { addDaysToKey, isValidDayKey } from "@/lib/dates";
import { dayKey, formatDayKey, plural } from "@/lib/format";
import { getJournalDay, tradesOfDay } from "@/lib/journal";
import { getSettings } from "@/lib/settings";
import { uploadUrl } from "@/lib/upload-url";

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  return { title: isValidDayKey(date) ? `Journal ${formatDayKey(date, "dd.MM.yyyy")}` : "Journal" };
}

function today(timeZone: string) {
  return dayKey(Date.now(), timeZone);
}

export default async function JournalDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const settings = getSettings();
  const tz = settings.displayTimezone;
  if (date === "today") redirect(`/journal/${today(tz)}`);
  if (!isValidDayKey(date)) notFound();

  const { entry, screenshots } = getJournalDay(date);
  const dayTrades = tradesOfDay(date, tz);
  const sums = new Map<string, number>();
  for (const t of dayTrades)
    if (t.status === "closed" && t.netPnl != null) sums.set(t.currency, (sums.get(t.currency) ?? 0) + t.netPnl);
  const isToday = date === today(tz);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 md:gap-4">
      <header className="card flex items-center gap-3 p-4 md:p-5">
        <Button asChild variant="ghost" size="icon" aria-label="Vorheriger Tag">
          <Link href={`/journal/${addDaysToKey(date, -1)}`}>
            <ChevronLeft />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <h1 className="text-h2 md:text-h1">{formatDayKey(date, "EEEE, d. MMMM yyyy")}</h1>
          <div className="flex flex-wrap items-center justify-center gap-2 text-small text-muted-foreground">
            {sums.size > 0
              ? [...sums.entries()].map(([currency, value]) => (
                  <PnlValue key={currency} value={value} currency={currency} className="text-[15px] font-semibold" />
                ))
              : null}
            <span>{plural(dayTrades.length, "Trade", "Trades")}</span>
          </div>
        </div>
        <Button asChild variant="ghost" size="icon" aria-label="Nächster Tag">
          <Link href={`/journal/${addDaysToKey(date, 1)}`}>
            <ChevronRight />
          </Link>
        </Button>
      </header>
      {!isToday ? (
        <div className="flex justify-center">
          <Button asChild variant="secondary" size="sm">
            <Link href="/journal/today">Heute</Link>
          </Button>
        </div>
      ) : null}

      <JournalDayEditor
        key={date}
        date={date}
        initial={{
          mood: entry?.mood ?? null,
          sleepHours: entry?.sleepHours != null ? String(entry.sleepHours) : "",
          focus: entry?.focus ?? null,
          premarketPlan: entry?.premarketPlan ?? "",
          review: entry?.review ?? "",
          lessons: entry?.lessons ?? "",
          followedPlan: entry?.followedPlan ?? null,
        }}
        tradesSection={
          <section className="card overflow-hidden">
            <h2 className="px-4 pt-4 pb-2 text-h2 md:px-5">Trades des Tages</h2>
            {dayTrades.length === 0 ? (
              <p className="px-4 pb-5 text-body text-muted-foreground md:px-5">
                Keine Trades an diesem Tag.{" "}
                <Link href="/trades/new" className="text-accent hover:underline">
                  Trade erfassen
                </Link>
              </p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {dayTrades.map((t) => (
                  <li key={t.id}>
                    <TradeCard trade={t} timeZone={tz} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        }
        screenshotsSection={
          <section className="card flex flex-col gap-4 p-4 md:p-5">
            <h2 className="text-h2">Screenshots</h2>
            <JournalScreenshots
              date={date}
              initial={screenshots.map((s) => ({
                key: s.id,
                id: s.id,
                previewUrl: uploadUrl(s.thumbPath),
                caption: s.caption ?? "",
              }))}
            />
          </section>
        }
      />
    </div>
  );
}
