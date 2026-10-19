import { ChevronRight, NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PnlValue } from "@/components/pnl-value";
import { Button } from "@/components/ui/button";
import { formatDayKey, plural } from "@/lib/format";
import { listJournalDays } from "@/lib/journal";
import { MOOD_EMOJI } from "@/lib/labels";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Journal" };

export default function JournalPage() {
  const settings = getSettings();
  const days = listJournalDays(settings.displayTimezone);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 md:gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body text-muted-foreground">{plural(days.length, "Tag", "Tage")}</p>
        <Button asChild>
          <Link href="/journal/today">
            <NotebookPen /> Heute
          </Link>
        </Button>
      </div>
      {days.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={NotebookPen}
            title="Noch keine Journal-Einträge"
            description="Plane deinen Handelstag und halte danach fest, was du gelernt hast."
            action={
              <Button asChild>
                <Link href="/journal/today">Heute starten</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="card divide-y divide-border overflow-hidden">
          {days.map((d) => (
            <li key={d.date}>
              <Link
                href={`/journal/${d.date}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 md:px-5"
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[20px]"
                  aria-hidden="true"
                >
                  {d.mood ? MOOD_EMOJI[d.mood - 1] : "·"}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14px] font-semibold">{formatDayKey(d.date, "EEEE, d. MMMM yyyy")}</span>
                  <span className="truncate text-small text-muted-foreground">
                    {d.firstLine || (d.hasEntry ? "Kein Review" : "Noch kein Eintrag")}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  {d.pnl.map((p) => (
                    <PnlValue
                      key={p.currency}
                      value={p.value}
                      currency={p.currency}
                      className="text-[14px] font-semibold"
                    />
                  ))}
                  <span className="text-small text-muted-foreground">
                    {d.trades > 0 ? plural(d.trades, "Trade", "Trades") : "Keine Trades"}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
