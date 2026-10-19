import { PnlValue } from "@/components/pnl-value";
import { RValue } from "@/components/r-value";
import { formatPercent, formatRatio } from "@/lib/format";
import type { GroupRow } from "@/lib/stats/report";
import { cn } from "@/lib/utils";

export type StatColumn = "trades" | "winRate" | "profitFactor" | "expectancyR" | "totalR" | "netPnl" | "rulesFollowed";

const HEADERS: Record<StatColumn, string> = {
  trades: "Trades",
  winRate: "Win Rate",
  profitFactor: "Profit Factor",
  expectancyR: "Expectancy R",
  totalR: "Total R",
  netPnl: "Netto P&L",
  rulesFollowed: "Regeln befolgt",
};

/** Grouped statistics table; rows with fewer than `minTrades` trades are flagged as low-data. */
export function StatTable({
  rows,
  columns,
  currency,
  labelHeader,
  minTrades,
  hideEmpty = true,
}: {
  rows: GroupRow[];
  columns: StatColumn[];
  currency: string;
  labelHeader: string;
  minTrades?: number;
  hideEmpty?: boolean;
}) {
  const shown = hideEmpty ? rows.filter((r) => r.trades > 0) : rows;
  if (shown.length === 0) return <p className="py-6 text-center text-body text-faint">Keine Daten im Zeitraum.</p>;
  return (
    <div className="-mx-4 overflow-x-auto md:mx-0">
      <table
        className={cn("w-full border-separate border-spacing-0 text-[13px]", columns.length > 4 && "min-w-[640px]")}
      >
        <thead>
          <tr>
            <th className="h-9 border-b border-border px-4 text-left text-small font-medium text-muted-foreground md:pl-0">
              {labelHeader}
            </th>
            {columns.map((c) => (
              <th
                key={c}
                className="h-9 border-b border-border px-3 text-right text-small font-medium whitespace-nowrap text-muted-foreground last:pr-4 md:last:pr-0"
              >
                {HEADERS[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const lowData = minTrades != null && r.trades < minTrades;
            return (
              <tr key={r.key}>
                <td className="h-11 border-b border-border px-4 md:pl-0">
                  <span className="flex items-center gap-2">
                    {r.color ? (
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                    ) : null}
                    <span className="font-medium">{r.label}</span>
                    {lowData && r.trades > 0 ? (
                      <span className="text-[11px] whitespace-nowrap text-faint">
                        Zu wenig Daten (&lt; {minTrades} Trades)
                      </span>
                    ) : null}
                  </span>
                </td>
                {columns.map((c) => (
                  <td
                    key={c}
                    className={cn(
                      "h-11 border-b border-border px-3 text-right whitespace-nowrap tabular-nums last:pr-4 md:last:pr-0",
                      lowData && "opacity-60",
                    )}
                  >
                    {c === "trades" ? r.trades : null}
                    {c === "winRate" ? formatPercent(r.winRate) : null}
                    {c === "profitFactor" ? formatRatio(r.profitFactor) : null}
                    {c === "expectancyR" ? <RValue value={r.expectancyR} /> : null}
                    {c === "totalR" ? <RValue value={r.totalR} className="font-semibold" /> : null}
                    {c === "netPnl" ? (
                      <PnlValue value={r.netPnl} currency={currency} className="font-semibold" />
                    ) : null}
                    {c === "rulesFollowed" ? formatPercent(r.rulesFollowed) : null}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
