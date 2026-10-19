import { ArrowRight, BookMarked, CircleAlert, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CalendarMonth } from "@/components/calendar-month";
import { DailyPnlChart, EquityChart } from "@/components/charts/lazy";
import { DirectionChip } from "@/components/direction-chip";
import { CandlesIllustration, EmptyState } from "@/components/empty-state";
import { InstallHint } from "@/components/install-hint";
import { KpiCard, WinLossDonut } from "@/components/kpi-card";
import { PnlValue } from "@/components/pnl-value";
import { RelativeTime } from "@/components/relative-time";
import { RValue } from "@/components/r-value";
import { Sparkline } from "@/components/sparkline";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guard";
import { downsample } from "@/lib/db/queries";
import { getFilter, type SearchParams } from "@/lib/filter-server";
import { formatDayKey, formatMoney, formatPercent, formatR, plural } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { calendarMonthData, dashboardData, greeting, hasAnyTrades } from "@/lib/stats/dashboard";

export const metadata: Metadata = { title: "Übersicht" };

function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card flex flex-col p-4 md:p-5 ${className ?? ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-h3">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function delta(current: number | null, previous: number | null | undefined) {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return current - previous;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const settings = getSettings();
  const tz = settings.displayTimezone;
  const hello = greeting(tz);

  if (!hasAnyTrades()) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-h1">
            {hello.text}, {user.username}
          </h1>
          <p className="text-body text-muted-foreground">{hello.date}</p>
        </div>
        <InstallHint />
        <div className="card">
          <EmptyState
            illustration={<CandlesIllustration />}
            title="Noch keine Trades"
            description="Erfasse deinen ersten Trade – es dauert weniger als 30 Sekunden."
            action={
              <Button asChild size="lg">
                <Link href="/trades/new">
                  <Plus /> Ersten Trade erfassen
                </Link>
              </Button>
            }
            className="py-16"
          />
        </div>
      </div>
    );
  }

  const filter = await getFilter(await searchParams);
  const data = dashboardData(filter, settings.baseCurrency, tz);
  const { metrics: m, previous: p, scope } = data;
  const currency = scope.currency;
  const [year, month] = hello.today.split("-").map(Number);
  const calendar = calendarMonthData(
    { year, month },
    tz,
    scope.accounts.map((a) => a.id),
    filter.accountId,
  );
  const curveValues = downsample(
    data.curve.map((c) => c.balance),
    60,
  );

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-h1">
          {hello.text}, {user.username}
        </h1>
        <p className="text-body text-muted-foreground">{hello.date}</p>
      </div>

      <InstallHint />

      {scope.others.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-small text-muted-foreground">
          <CircleAlert className="size-4 text-be" />
          Konten in anderen Währungen werden separat angezeigt.
          {scope.others.map((o) => (
            <span key={o.currency} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5">
              <PnlValue value={o.netPnl} currency={o.currency} className="font-semibold" />
              <span className="text-faint">· {plural(o.trades, "Trade", "Trades")}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <KpiCard
          label="Netto P&L"
          value={m.netPnl}
          format={{ kind: "money", currency }}
          delta={p ? delta(m.netPnl, p.netPnl) : null}
          sub={plural(m.trades, "Trade", "Trades")}
          chart={<Sparkline values={curveValues} height={36} />}
        />
        <KpiCard
          label="Win Rate"
          value={m.winRate}
          format={{ kind: "percent" }}
          delta={p ? delta(m.winRate, p.winRate) : null}
          sub={
            <span className="flex items-center gap-1.5 whitespace-nowrap max-sm:text-[11px]">
              <WinLossDonut wins={m.wins} losses={m.losses} breakEven={m.breakEven} size={24} />
              <span className="tabular-nums">
                {m.wins} G · {m.losses} V · {m.breakEven} BE
              </span>
            </span>
          }
        />
        <KpiCard
          label="Profit Factor"
          value={m.profitFactor}
          format={{ kind: "ratio" }}
          delta={p ? delta(m.profitFactor, p.profitFactor) : null}
          sub={`Payoff ${m.payoffRatio != null ? m.payoffRatio.toFixed(2) : "n/a"}`}
        />
        <KpiCard
          label="Expectancy"
          value={m.expectancy}
          format={{ kind: "money", currency }}
          delta={p ? delta(m.expectancy, p.expectancy) : null}
          sub={`${formatR(m.expectancyR)} pro Trade`}
        />
      </div>

      <Section
        title="Equity-Kurve"
        action={
          data.curve.length > 1 ? (
            <span className="text-small text-muted-foreground tabular-nums">
              {formatMoney(data.curve[data.curve.length - 1].balance, currency)}
            </span>
          ) : null
        }
      >
        {data.closed.length > 0 ? (
          <EquityChart data={data.curve} currency={currency} timeZone={tz} />
        ) : (
          <p className="flex h-[260px] items-center justify-center text-body text-muted-foreground">
            Keine abgeschlossenen Trades im Zeitraum.
          </p>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
        <Section
          title="Tages-P&L"
          className="lg:col-span-2"
          action={<span className="text-small text-muted-foreground">Letzte 30 Handelstage</span>}
        >
          {data.daily.length > 0 ? (
            <DailyPnlChart data={data.daily} currency={currency} />
          ) : (
            <p className="flex h-[200px] items-center justify-center text-body text-muted-foreground">
              Keine Daten im Zeitraum.
            </p>
          )}
        </Section>
        <Section
          title={formatDayKey(`${hello.today.slice(0, 7)}-01`, "MMMM yyyy")}
          action={
            <Link href="/calendar" className="text-small text-muted-foreground hover:text-foreground">
              Kalender
            </Link>
          }
        >
          <CalendarMonth
            month={{ year, month }}
            days={calendar.days}
            weekStartsOn={settings.weekStartsOn}
            today={hello.today}
            currency={currency}
            variant="mini"
          />
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
        <Section
          title="Letzte Trades"
          className="lg:col-span-2"
          action={
            <Link
              href="/trades"
              className="inline-flex items-center gap-1 text-small font-medium text-accent hover:underline"
            >
              Alle Trades <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          {data.recent.length === 0 ? (
            <p className="py-6 text-center text-body text-muted-foreground">Keine Trades im Zeitraum.</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {data.recent.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/trades/${t.id}`}
                    className="flex h-12 items-center gap-3 rounded-[10px] px-2 transition-colors hover:bg-surface-2"
                  >
                    <span className="w-20 truncate text-[14px] font-semibold">{t.symbol}</span>
                    <DirectionChip direction={t.direction} size="sm" />
                    <span className="hidden flex-1 text-small text-muted-foreground sm:block">
                      <RelativeTime ts={t.closedAt ?? t.openedAt} timeZone={tz} />
                    </span>
                    <span className="flex-1 sm:hidden" />
                    <RValue value={t.rMultiple} className="w-16 text-right text-[13px]" />
                    <span className="w-28 text-right">
                      {t.netPnl != null ? (
                        <PnlValue value={t.netPnl} currency={t.currency} className="text-[14px] font-semibold" />
                      ) : (
                        <span className="text-small text-accent">Offen</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <div className="flex flex-col gap-3 md:gap-4">
          <Section title="Top Setups">
            {data.setups.length === 0 ? (
              <div className="flex flex-col items-start gap-2 py-2">
                <p className="text-body text-muted-foreground">Noch keine Trades mit Setup im Zeitraum.</p>
                <Link href="/playbooks" className="inline-flex items-center gap-1 text-small font-medium text-accent">
                  <BookMarked className="size-3.5" /> Playbooks
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {data.setups.map((s) => (
                  <li key={s.key}>
                    <Link href={`/playbooks/${s.key}`} prefetch={false} className="flex items-center gap-3">
                      <span className="h-8 w-1 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[14px] font-medium">{s.name}</span>
                        <span className="text-small text-muted-foreground">
                          {plural(s.trades, "Trade", "Trades")} · {formatPercent(s.winRate)}
                        </span>
                      </span>
                      <RValue value={s.totalR} className="text-[14px] font-semibold" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Top-Fehler">
            {data.mistakes.length === 0 ? (
              <p className="py-2 text-body text-muted-foreground">Keine kostspieligen Fehler im Zeitraum. Weiter so!</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {data.mistakes.map((mk) => (
                  <li key={mk.id} className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-loss-soft">
                      <CircleAlert className="size-4 text-loss" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-medium">{mk.name}</span>
                      <span className="text-small text-muted-foreground">
                        kostet dich {formatMoney(Math.abs(mk.netPnl), currency, { decimals: 0 })}
                      </span>
                    </span>
                    <span className="text-small text-muted-foreground tabular-nums">{mk.trades}×</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
