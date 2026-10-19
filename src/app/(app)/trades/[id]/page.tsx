import { Check, ExternalLink, Minus, Plus, Star, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DirectionChip } from "@/components/direction-chip";
import { MarkdownView } from "@/components/markdown-view";
import { PnlValue } from "@/components/pnl-value";
import { ResultChip } from "@/components/result-chip";
import { RValue } from "@/components/r-value";
import { executionLabels } from "@/components/trade-form/payload";
import { ScreenshotGallery } from "@/components/trade-detail/screenshot-gallery";
import { TradeActions } from "@/components/trade-detail/trade-actions";
import { Button } from "@/components/ui/button";
import { isOpeningSide } from "@/lib/calc/trade";
import { adjacentTrades, getTradeDetail } from "@/lib/db/queries";
import { getFilter, type SearchParams } from "@/lib/filter-server";
import { formatDateTime, formatDecimal, formatDuration, formatMoney, formatNumber, formatPrice } from "@/lib/format";
import { SESSION_LABELS } from "@/lib/sessions";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = getTradeDetail(id);
  return { title: detail ? `${detail.instrument.symbol} Trade` : "Trade" };
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-small text-muted-foreground">{label}</dt>
      <dd className="text-[14px] font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function Card({
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
    <section className={cn("card p-4 md:p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-h3">{title}</h2>
        {aside ? <span className="text-small text-muted-foreground">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-faint">–</span>;
  return (
    <span role="img" className="inline-flex items-center gap-0.5" aria-label={`${value} von 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= value ? "fill-be text-be" : "text-faint")} strokeWidth={1.75} />
      ))}
    </span>
  );
}

export default async function TradeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const detail = getTradeDetail(id);
  if (!detail) notFound();
  const settings = getSettings();
  const tz = settings.displayTimezone;
  const filter = await getFilter(await searchParams);
  const { prevId, nextId } = adjacentTrades(id, detail.trade.openedAt, filter);
  const { trade, instrument, account } = detail;
  const currency = account.currency;
  const labels = executionLabels(
    detail.executions.map((e) => ({ side: e.side, qty: String(e.qty) })),
    trade.direction,
  );
  const totalFees = detail.executions.reduce((a, e) => a + e.fee, 0) + trade.fees;
  const checked = detail.rules.filter((r) => r.checked).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3 md:gap-4">
      <header className="card flex flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-display">{instrument.symbol}</h1>
              <DirectionChip direction={trade.direction} />
              <ResultChip result={trade.result} />
            </div>
            <p className="text-body text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: account.color }} />
                {account.name}
              </span>
              {" · "}
              {formatDateTime(trade.openedAt, tz)}
              {detail.playbook ? (
                <>
                  {" · "}
                  <Link
                    href={`/playbooks/${detail.playbook.id}`}
                    className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                  >
                    {detail.playbook.name}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            {trade.netPnl != null ? (
              <PnlValue value={trade.netPnl} currency={currency} className="text-display" />
            ) : (
              <span className="text-display text-muted-foreground">Offen</span>
            )}
            <RValue value={trade.rMultiple} className="text-h3" />
          </div>
        </div>
        <TradeActions id={id} prevId={prevId} nextId={nextId} />
      </header>

      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3 md:gap-4">
          {detail.screenshots.length > 0 ? (
            <Card title="Screenshots" aside={String(detail.screenshots.length)}>
              <ScreenshotGallery shots={detail.screenshots} />
            </Card>
          ) : null}

          <Card title="Details">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Info label="Einstieg Ø">{formatPrice(trade.entryAvg)}</Info>
              <Info label="Ausstieg Ø">{formatPrice(trade.exitAvg)}</Info>
              <Info label="Menge">
                {formatDecimal(trade.qtyOpened, 4)}
                {trade.status === "open" && trade.qtyClosed > 0
                  ? ` (${formatDecimal(trade.qtyClosed, 4)} geschlossen)`
                  : ""}
              </Info>
              <Info label="Stop Loss">{formatPrice(trade.initialStop)}</Info>
              <Info label="Take Profit">{formatPrice(trade.initialTarget)}</Info>
              <Info label="Risiko">{trade.initialRisk != null ? formatMoney(trade.initialRisk, currency) : "–"}</Info>
              <Info label="Haltedauer">{formatDuration(trade.holdMinutes)}</Info>
              <Info label="Session">{SESSION_LABELS[trade.session]}</Info>
              <Info label="Timeframe">{trade.timeframe ?? "–"}</Info>
              <Info label="Gebühren">{formatMoney(totalFees, currency)}</Info>
              <Info label="Swap">{formatMoney(trade.swap, currency, { signed: true })}</Info>
              <Info label="Brutto P&L">
                {trade.grossPnl != null ? formatMoney(trade.grossPnl, currency, { signed: true }) : "–"}
              </Info>
              {trade.fxRate !== 1 ? (
                <Info label="FX-Kurs">
                  1 {instrument.quoteCurrency} = {formatDecimal(trade.fxRate, 6)} {currency}
                </Info>
              ) : null}
              {trade.pnlMode === "manual" ? <Info label="P&L-Modus">Manuell</Info> : null}
            </dl>
          </Card>

          <Card title="Ausführungen" aside={String(detail.executions.length)}>
            {detail.executions.length === 0 ? (
              <p className="text-body text-muted-foreground">Noch keine Ausführungen erfasst.</p>
            ) : (
              <ol className="relative flex flex-col gap-4 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[9px] before:w-px before:bg-border">
                {detail.executions.map((e, i) => {
                  const opening = isOpeningSide(trade.direction, e.side);
                  return (
                    <li key={e.id} className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span
                        className={cn(
                          "absolute top-1 -left-6 flex size-[19px] items-center justify-center rounded-full border-2 border-surface",
                          opening ? "bg-accent text-white" : "bg-surface-3 text-foreground",
                        )}
                      >
                        {opening ? (
                          <Plus className="size-2.5" strokeWidth={3.5} />
                        ) : (
                          <Minus className="size-2.5" strokeWidth={3.5} />
                        )}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[14px] font-medium">
                          {labels[i]} · {e.side === "buy" ? "Kauf" : "Verkauf"}
                        </span>
                        <span className="text-small text-muted-foreground tabular-nums">
                          {formatDateTime(e.executedAt, tz)}
                        </span>
                      </div>
                      <span className="text-[14px] tabular-nums">
                        {formatDecimal(e.qty, 4)} @ {formatPrice(e.price)}
                        {e.fee > 0 ? (
                          <span className="text-small text-muted-foreground">
                            {" "}
                            · Gebühr {formatMoney(e.fee, currency)}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          {trade.notes?.trim() || trade.tradingviewUrl ? (
            <Card title="Notizen">
              <div className="flex flex-col gap-4">
                <MarkdownView value={trade.notes} />
                {trade.tradingviewUrl ? (
                  <Button asChild variant="secondary" size="sm" className="w-fit">
                    <a href={trade.tradingviewUrl} target="_blank" rel="noreferrer noopener">
                      <ExternalLink /> TradingView öffnen
                    </a>
                  </Button>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3 md:gap-4">
          {detail.playbook ? (
            <Card title="Playbook-Checkliste" aside={`${checked} / ${detail.rules.length} Regeln befolgt`}>
              {detail.rules.length === 0 ? (
                <p className="text-body text-muted-foreground">Keine Regeln definiert.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detail.rules.map((r) => (
                    <li key={r.id} className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                          r.checked ? "bg-profit-soft text-profit" : "bg-surface-2 text-faint",
                        )}
                      >
                        {r.checked ? (
                          <Check className="size-3" strokeWidth={3} />
                        ) : (
                          <X className="size-3" strokeWidth={3} />
                        )}
                      </span>
                      <span className={cn("text-[14px]", !r.checked && "text-muted-foreground")}>{r.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          <Card title="Psychologie">
            <dl className="grid grid-cols-2 gap-4">
              <Info label="Emotion vorher">{trade.emotionBefore ?? "–"}</Info>
              <Info label="Emotion nachher">{trade.emotionAfter ?? "–"}</Info>
              <Info label="Selbstvertrauen">
                {trade.confidence != null ? `${formatNumber(trade.confidence, 0)} / 5` : "–"}
              </Info>
              <Info label="Ausführung">
                <Stars value={trade.executionRating} />
              </Info>
            </dl>
            {detail.mistakes.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {detail.mistakes.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex h-7 items-center rounded-full bg-loss-soft px-3 text-[12px] font-semibold text-loss"
                  >
                    {m.name}
                  </span>
                ))}
              </div>
            ) : null}
          </Card>

          {detail.tags.length > 0 ? (
            <Card title="Tags">
              <div className="flex flex-wrap gap-1.5">
                {detail.tags.map((t) => (
                  <Link
                    key={t.id}
                    href={`/trades?tags=${t.id}&range=all`}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12px] font-semibold transition-colors hover:bg-surface-3"
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.name}
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
