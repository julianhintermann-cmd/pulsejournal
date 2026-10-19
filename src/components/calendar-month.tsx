import Link from "next/link";

import { monthGrid, weekdayLabels, type MonthKey } from "@/lib/calendar";
import { formatDayKey, formatMoneyCompact, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CalendarDayData = { netPnl: number; trades: number; journal: boolean };

function intensity(value: number, max: number) {
  if (max <= 0 || value === 0) return 0;
  return 0.12 + 0.48 * Math.min(1, Math.abs(value) / max);
}

function cellStyle(data: CalendarDayData | undefined, max: number): React.CSSProperties | undefined {
  if (!data || data.trades === 0 || Math.round(data.netPnl * 100) === 0) return undefined;
  const pct = Math.round(intensity(data.netPnl, max) * 100);
  const color = data.netPnl > 0 ? "var(--profit)" : "var(--loss)";
  return { backgroundColor: `color-mix(in srgb, ${color} ${pct}%, transparent)` };
}

/**
 * Month grid coloured by daily P&L intensity (relative to the month's largest day).
 * `variant="mini"` is the dashboard version (links to the journal day); `"full"` adds trade counts,
 * journal dots and week totals.
 */
export function CalendarMonth({
  month,
  days,
  weekStartsOn,
  today,
  currency,
  variant = "full",
  onSelect,
}: {
  month: MonthKey;
  days: Record<string, CalendarDayData>;
  weekStartsOn: number;
  today: string;
  currency: string;
  variant?: "mini" | "full";
  onSelect?: (day: string) => void;
}) {
  const weeks = monthGrid(month, weekStartsOn);
  const labels = weekdayLabels(weekStartsOn);
  const max = Math.max(0, ...Object.values(days).map((d) => Math.abs(d.netPnl)));
  const mini = variant === "mini";

  const dayContent = (day: string) => {
    const data = days[day];
    const n = Number(day.slice(8));
    const pnl = data && data.trades > 0 ? data.netPnl : null;
    return (
      <>
        <span className={cn("flex items-center justify-between", mini ? "text-[11px]" : "text-[12px]")}>
          <span
            className={cn(
              "inline-flex size-5 items-center justify-center rounded-full font-semibold tabular-nums",
              day === today && "bg-accent text-white",
            )}
          >
            {n}
            <span className="sr-only"> {formatDayKey(day, "MMMM yyyy")}</span>
          </span>
          {!mini && data?.journal ? (
            <span className="size-1.5 rounded-full bg-accent" aria-label="Journal-Eintrag" />
          ) : null}
        </span>
        {pnl != null && !mini ? (
          <span
            className={cn(
              "truncate font-semibold tabular-nums",
              "text-[11px] md:text-[13px]",
              pnl > 0 ? "text-profit" : pnl < 0 ? "text-loss" : "text-muted-foreground",
            )}
          >
            {formatMoneyCompact(pnl)}
          </span>
        ) : null}
        {!mini && data && data.trades > 0 ? (
          <span className="hidden truncate text-[11px] text-muted-foreground md:block">
            {plural(data.trades, "Trade", "Trades")}
          </span>
        ) : null}
      </>
    );
  };

  const cellClass = cn(
    "flex min-w-0 flex-col justify-between overflow-hidden rounded-[10px] border border-transparent text-left transition-colors",
    mini ? "aspect-square gap-0.5 p-1" : "min-h-[64px] gap-1 p-1.5 md:min-h-[96px] md:p-2.5",
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "grid gap-1.5",
          !mini ? "grid-cols-7 md:grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,0.9fr)]" : "grid-cols-7",
        )}
      >
        {labels.map((l) => (
          <span key={l} className="px-1 text-center text-[11px] font-semibold text-muted-foreground uppercase">
            {l}
          </span>
        ))}
        {!mini ? (
          <span className="hidden px-1 text-center text-[11px] font-semibold text-muted-foreground uppercase md:block">
            Woche
          </span>
        ) : null}
      </div>
      {weeks.map((week, wi) => {
        const weekDays = week.filter((d): d is string => d != null);
        const weekPnl = weekDays.reduce((a, d) => a + (days[d]?.netPnl ?? 0), 0);
        const weekTrades = weekDays.reduce((a, d) => a + (days[d]?.trades ?? 0), 0);
        return (
          <div key={wi} className="flex flex-col gap-1.5">
            <div
              className={cn(
                "grid gap-1.5",
                !mini ? "grid-cols-7 md:grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,0.9fr)]" : "grid-cols-7",
              )}
            >
              {week.map((day, di) =>
                day == null ? (
                  <span key={di} className={cn(mini ? "aspect-square" : "min-h-[64px] md:min-h-[96px]")} />
                ) : mini ? (
                  <Link
                    key={day}
                    href={`/journal/${day}`}
                    prefetch={false}
                    className={cn(cellClass, "bg-surface-2/60 hover:border-border")}
                    style={cellStyle(days[day], max)}
                  >
                    {dayContent(day)}
                  </Link>
                ) : (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onSelect?.(day)}
                    className={cn(cellClass, "bg-surface-2/60 hover:border-border")}
                    style={cellStyle(days[day], max)}
                    data-day={day}
                  >
                    {dayContent(day)}
                  </button>
                ),
              )}
              {!mini ? (
                <div className="hidden min-h-[96px] flex-col justify-center rounded-[10px] border border-border px-2.5 md:flex">
                  <span
                    className={cn(
                      "text-[13px] font-semibold tabular-nums",
                      weekPnl > 0 ? "text-profit" : weekPnl < 0 ? "text-loss" : "text-muted-foreground",
                    )}
                  >
                    {weekTrades > 0 ? formatMoneyCompact(weekPnl, currency) : "–"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{plural(weekTrades, "Trade", "Trades")}</span>
                </div>
              ) : null}
            </div>
            {!mini && weekTrades > 0 ? (
              <div className="flex items-center justify-between rounded-[8px] bg-surface-2/60 px-2.5 py-1 text-[11px] md:hidden">
                <span className="text-muted-foreground">Woche · {plural(weekTrades, "Trade", "Trades")}</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    weekPnl > 0 ? "text-profit" : weekPnl < 0 ? "text-loss" : "text-muted-foreground",
                  )}
                >
                  {formatMoneyCompact(weekPnl, currency)}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
