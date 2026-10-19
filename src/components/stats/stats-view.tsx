"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { BarListChart, DrawdownChart, EquityChart, Histogram } from "@/components/charts/lazy";
import { PnlValue } from "@/components/pnl-value";
import { RValue } from "@/components/r-value";
import { StatTable } from "@/components/stat-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDuration,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  formatR,
  formatRatio,
  plural,
} from "@/lib/format";
import type { EquityPoint } from "@/lib/stats/queries";
import { MIN_BUCKET_TRADES } from "@/lib/stats/constants";
import type { GroupRow, Report } from "@/lib/stats/report";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "overview", label: "Übersicht" },
  { value: "setups", label: "Setups" },
  { value: "time", label: "Zeit" },
  { value: "symbols", label: "Symbole" },
  { value: "psychology", label: "Psychologie" },
  { value: "r", label: "R-Verteilung" },
] as const;

function Panel({
  title,
  children,
  className,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className={cn("card flex min-w-0 flex-col p-4 md:p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-h3">{title}</h2>
        {aside ? <span className="text-small text-muted-foreground">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

function MetricRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <dt className="text-body text-muted-foreground">{label}</dt>
      <dd className="text-right text-[14px] font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function pnlBars(rows: GroupRow[], currency: string) {
  return rows
    .filter((r) => r.trades > 0)
    .map((r) => ({
      label: r.label,
      value: r.netPnl,
      tooltip: [
        { label: "Netto P&L", value: formatMoney(r.netPnl, currency, { signed: true }) },
        { label: "Win Rate", value: formatPercent(r.winRate) },
        { label: "Trades", value: String(r.trades) },
      ],
    }));
}

/** Win-rate grid for 1–5 scales with the low-data hint. */
function ScaleRates({ rows }: { rows: GroupRow[] }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {rows.map((r) => {
        const low = r.trades < MIN_BUCKET_TRADES;
        return (
          <div
            key={r.key}
            className="flex flex-col items-center gap-1 rounded-[12px] bg-surface-2 px-1 py-3 text-center"
          >
            <span className="text-small text-muted-foreground">{r.label}</span>
            <span className={cn("text-h3 tabular-nums", low && "text-muted-foreground")}>
              {r.trades > 0 ? formatPercent(r.winRate, { decimals: 0 }) : "–"}
            </span>
            <span className="text-[11px] text-muted-foreground">{plural(r.trades, "Trade", "Trades")}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StatsView({
  report,
  curve,
  currency,
  timeZone,
  tradeCount,
  initialTab,
}: {
  report: Report;
  curve: EquityPoint[];
  currency: string;
  timeZone: string;
  tradeCount: number;
  initialTab: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTabState] = useState(TABS.some((t) => t.value === initialTab) ? initialTab : "overview");
  const m = report.metrics;
  const money = (v: number) => formatMoneyCompact(v);
  const lowDataHint = (rows: GroupRow[]) =>
    rows.some((r) => r.trades > 0 && r.trades < MIN_BUCKET_TRADES) ? (
      <p className="mt-2 text-small text-muted-foreground">
        Zu wenig Daten (&lt; {MIN_BUCKET_TRADES} Trades) – blasse Werte mit Vorsicht lesen.
      </p>
    ) : null;

  const setTab = (value: string) => {
    setTabState(value);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (tradeCount === 0) {
    return (
      <div className="card px-6 py-16 text-center">
        <h2 className="text-h3">Keine abgeschlossenen Trades im Zeitraum</h2>
        <p className="mt-1 text-body text-muted-foreground">Wähle oben einen anderen Zeitraum oder erfasse Trades.</p>
      </div>
    );
  }

  const streak = m.currentStreak.type
    ? m.currentStreak.type === "win"
      ? plural(m.currentStreak.length, "Gewinn", "Gewinne")
      : plural(m.currentStreak.length, "Verlust", "Verluste")
    : "–";

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full justify-start md:w-fit">
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="flex flex-col gap-3 md:gap-4">
        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <Panel title="Kennzahlen">
            <dl className="flex flex-col">
              <MetricRow label="Netto P&L">
                <PnlValue value={m.netPnl} currency={currency} />
              </MetricRow>
              <MetricRow label="Trades">{m.trades}</MetricRow>
              <MetricRow label="Win Rate">{formatPercent(m.winRate)}</MetricRow>
              <MetricRow label="Ø Gewinn">
                {m.avgWin != null ? <PnlValue value={m.avgWin} currency={currency} /> : "n/a"}
              </MetricRow>
              <MetricRow label="Ø Verlust">
                {m.avgLoss != null ? <PnlValue value={m.avgLoss} currency={currency} /> : "n/a"}
              </MetricRow>
              <MetricRow label="Payoff Ratio">{formatRatio(m.payoffRatio)}</MetricRow>
              <MetricRow label="Profit Factor">{formatRatio(m.profitFactor)}</MetricRow>
              <MetricRow label="Expectancy">
                {m.expectancy != null ? <PnlValue value={m.expectancy} currency={currency} /> : "n/a"}
              </MetricRow>
              <MetricRow label="Expectancy (R)">
                <RValue value={m.expectancyR} />
              </MetricRow>
              <MetricRow label="Total R">
                <RValue value={m.totalR} />
              </MetricRow>
              <MetricRow label="Max Drawdown">
                <span className="text-loss">
                  {formatMoney(-report.drawdown.amount, currency)}
                  {report.drawdown.percent != null ? ` · ${formatPercent(-report.drawdown.percent)}` : ""}
                </span>
              </MetricRow>
              <MetricRow label="Längste Gewinnserie">{m.longestWinStreak}</MetricRow>
              <MetricRow label="Längste Verlustserie">{m.longestLossStreak}</MetricRow>
              <MetricRow label="Aktuelle Serie">{streak}</MetricRow>
              <MetricRow label="Bester Trade">
                {m.best != null ? <PnlValue value={m.best} currency={currency} /> : "–"}
              </MetricRow>
              <MetricRow label="Schlechtester Trade">
                {m.worst != null ? <PnlValue value={m.worst} currency={currency} /> : "–"}
              </MetricRow>
              <MetricRow label="Ø Haltedauer">{formatDuration(m.avgHoldMinutes)}</MetricRow>
              <MetricRow label="Regeln befolgt">{formatPercent(m.rulesFollowed)}</MetricRow>
            </dl>
          </Panel>
          <div className="flex min-w-0 flex-col gap-3 md:gap-4">
            <Panel title="Equity-Kurve">
              <EquityChart data={curve} currency={currency} timeZone={timeZone} height={280} />
            </Panel>
            <Panel title="Drawdown" aside={formatMoney(-report.drawdown.amount, currency)}>
              <DrawdownChart data={report.underwater} currency={currency} timeZone={timeZone} />
            </Panel>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="setups" className="flex flex-col gap-3 md:gap-4">
        <Panel title="Setups">
          <StatTable
            rows={report.setups}
            labelHeader="Setup"
            currency={currency}
            columns={["trades", "winRate", "profitFactor", "expectancyR", "totalR", "netPnl", "rulesFollowed"]}
          />
        </Panel>
        <Panel title="Total R pro Setup">
          <BarListChart
            layout="horizontal"
            data={report.setups
              .filter((s) => s.trades > 0)
              .map((s) => ({
                label: s.label,
                value: s.totalR,
                tooltip: [
                  { label: "Total R", value: formatR(s.totalR) },
                  { label: "Trades", value: String(s.trades) },
                ],
              }))}
            format={(v) => formatR(v, 1)}
          />
        </Panel>
      </TabsContent>

      <TabsContent value="time" className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
        {(
          [
            ["Wochentag", report.byWeekday, "Tag"],
            ["Einstiegsstunde", report.byHour, "Stunde"],
            ["Session", report.bySession, "Session"],
            ["Haltedauer", report.byHold, "Dauer"],
          ] as const
        ).map(([title, rows, header]) => (
          <Panel key={title} title={`P&L nach ${title}`}>
            <BarListChart data={pnlBars(rows, currency)} format={money} />
            <div className="mt-3">
              <StatTable
                rows={rows}
                labelHeader={header}
                currency={currency}
                columns={["trades", "winRate", "netPnl"]}
                minTrades={MIN_BUCKET_TRADES}
              />
            </div>
          </Panel>
        ))}
      </TabsContent>

      <TabsContent value="symbols" className="flex flex-col gap-3 md:gap-4">
        <div className="grid grid-cols-1 gap-3 md:gap-4 sm:grid-cols-2">
          {report.longShort.map((side) => (
            <Panel key={side.key} title={side.label} aside={plural(side.trades, "Trade", "Trades")}>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col">
                  <span className="text-small text-muted-foreground">Netto P&L</span>
                  <PnlValue value={side.netPnl} currency={currency} className="text-h3" />
                </div>
                <div className="flex flex-col">
                  <span className="text-small text-muted-foreground">Win Rate</span>
                  <span className="text-h3 tabular-nums">{formatPercent(side.winRate)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-small text-muted-foreground">Total R</span>
                  <RValue value={side.totalR} className="text-h3" />
                </div>
              </div>
            </Panel>
          ))}
        </div>
        <Panel title="P&L nach Symbol">
          <BarListChart data={pnlBars(report.symbols, currency)} format={money} />
        </Panel>
        <Panel title="Symbole">
          <StatTable
            rows={report.symbols}
            labelHeader="Symbol"
            currency={currency}
            columns={["trades", "winRate", "profitFactor", "expectancyR", "totalR", "netPnl"]}
          />
        </Panel>
      </TabsContent>

      <TabsContent value="psychology" className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
        <Panel title="Emotion vorher">
          {report.byEmotion.length > 0 ? (
            <>
              <BarListChart layout="horizontal" data={pnlBars(report.byEmotion, currency)} format={money} />
              <div className="mt-3">
                <StatTable
                  rows={report.byEmotion}
                  labelHeader="Emotion"
                  currency={currency}
                  columns={["trades", "winRate", "netPnl"]}
                  minTrades={MIN_BUCKET_TRADES}
                />
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-body text-muted-foreground">Keine Emotionen erfasst.</p>
          )}
        </Panel>
        <Panel title="Kosten pro Fehler">
          {report.mistakeCosts.length === 0 ? (
            <p className="py-6 text-center text-body text-muted-foreground">Keine Fehler erfasst.</p>
          ) : (
            <ul className="flex flex-col">
              {report.mistakeCosts.map((mk, i) => (
                <li key={mk.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
                  <span className="w-5 text-small text-muted-foreground tabular-nums">{i + 1}.</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-medium">{mk.label}</span>
                    <span className="text-small text-muted-foreground">
                      {plural(mk.trades, "Trade", "Trades")}
                      {mk.trades < MIN_BUCKET_TRADES ? ` · Zu wenig Daten (< ${MIN_BUCKET_TRADES} Trades)` : ""}
                    </span>
                  </span>
                  <PnlValue value={mk.netPnl} currency={currency} className="text-[14px] font-semibold" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Win Rate nach Selbstvertrauen">
          <ScaleRates rows={report.byConfidence} />
          {lowDataHint(report.byConfidence)}
        </Panel>
        <Panel title="Win Rate nach Ausführung">
          <ScaleRates rows={report.byExecution} />
          {lowDataHint(report.byExecution)}
        </Panel>
      </TabsContent>

      <TabsContent value="r" className="flex flex-col gap-3 md:gap-4">
        <Panel
          title="R-Verteilung"
          aside={`Ø ${formatR(report.histogram.mean)} · Median ${formatR(report.histogram.median)}`}
        >
          {report.histogram.buckets.some((b) => b.count > 0) ? (
            <Histogram
              buckets={report.histogram.buckets}
              mean={report.histogram.mean}
              median={report.histogram.median}
              height={300}
            />
          ) : (
            <p className="py-10 text-center text-body text-muted-foreground">
              Keine Trades mit Stop Loss (R) im Zeitraum.
            </p>
          )}
        </Panel>
      </TabsContent>
    </Tabs>
  );
}
