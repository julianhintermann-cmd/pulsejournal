import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarkdownView } from "@/components/markdown-view";
import { PlaybookActions } from "@/components/playbooks/playbook-actions";
import { RValue } from "@/components/r-value";
import { StatTable } from "@/components/stat-table";
import { TradeCard } from "@/components/trades/trade-card";
import { listTrades } from "@/lib/db/queries";
import { getFilter, type SearchParams } from "@/lib/filter-server";
import { plural } from "@/lib/format";
import { bestExamples, getPlaybook } from "@/lib/playbooks";
import { getSettings } from "@/lib/settings";
import { currencyScope, loadClosedTrades } from "@/lib/stats/queries";
import { buildReport } from "@/lib/stats/report";
import { uploadUrl } from "@/lib/upload-url";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: getPlaybook(id)?.name ?? "Playbook" };
}

export default async function PlaybookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const playbook = getPlaybook(id);
  if (!playbook) notFound();
  const settings = getSettings();
  const tz = settings.displayTimezone;
  const filter = await getFilter(await searchParams);
  const scope = currencyScope(filter, settings.baseCurrency);
  const closed = loadClosedTrades(filter, { accountIds: scope.accounts.map((a) => a.id) }).filter(
    (t) => t.playbookId === id,
  );
  const report = buildReport(closed, [], tz);
  const row = report.setups.find((s) => s.key === id);
  const tradeRows = listTrades(filter).filter((t) => t.playbook?.id === id);
  const examples = bestExamples(id);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3 md:gap-4">
      <header className="card overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: playbook.color }} />
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-display">{playbook.name}</h1>
              <p className="text-body text-muted-foreground">
                {plural(playbook.rules.length, "Regel", "Regeln")} · {plural(tradeRows.length, "Trade", "Trades")} im
                Zeitraum
                {playbook.archived ? " · Archiviert" : ""}
              </p>
            </div>
            {row ? <RValue value={row.totalR} className="text-display" /> : null}
          </div>
          <PlaybookActions
            archived={playbook.archived}
            playbook={{
              id: playbook.id,
              name: playbook.name,
              color: playbook.color,
              description: playbook.description,
              rules: playbook.rules,
            }}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
        <section className="card p-4 md:p-5">
          <h2 className="mb-3 text-h3">Beschreibung</h2>
          {playbook.description?.trim() ? (
            <MarkdownView value={playbook.description} />
          ) : (
            <p className="text-body text-muted-foreground">Noch keine Beschreibung.</p>
          )}
        </section>
        <section className="card p-4 md:p-5">
          <h2 className="mb-3 text-h3">Regeln</h2>
          {playbook.rules.length === 0 ? (
            <p className="text-body text-muted-foreground">Noch keine Regeln definiert.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {playbook.rules.map((r, i) => (
                <li key={r.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                    {i + 1}
                  </span>
                  <span className="text-[14px]">{r.text}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="card p-4 md:p-5">
        <h2 className="mb-3 text-h3">Statistik</h2>
        <StatTable
          rows={row ? [row] : []}
          labelHeader="Setup"
          currency={scope.currency}
          columns={["trades", "winRate", "profitFactor", "expectancyR", "totalR", "netPnl", "rulesFollowed"]}
        />
      </section>

      {examples.length > 0 ? (
        <section className="card p-4 md:p-5">
          <h2 className="mb-3 text-h3">Beste Beispiele</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {examples.map((ex) => (
              <Link
                key={ex.tradeId}
                href={`/trades/${ex.tradeId}`}
                className="group relative aspect-[16/10] overflow-hidden rounded-[12px] border border-border bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- auth-protected upload served by the API route */}
                <img
                  src={uploadUrl(ex.shot.thumbPath)}
                  alt={ex.shot.caption ?? ""}
                  loading="lazy"
                  className="size-full object-cover transition-transform group-hover:scale-[1.02]"
                />
                <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-semibold text-white tabular-nums">
                  <Check className="mr-1 inline size-3" />
                  {ex.rMultiple >= 0 ? "+" : "−"}
                  {Math.abs(ex.rMultiple).toFixed(2)}R
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card overflow-hidden">
        <h2 className="px-4 pt-4 pb-2 text-h3 md:px-5">Trades</h2>
        {tradeRows.length === 0 ? (
          <p className="px-4 pb-5 text-body text-muted-foreground md:px-5">
            Keine Trades mit diesem Setup im Zeitraum.
          </p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {tradeRows.slice(0, 100).map((t) => (
              <li key={t.id}>
                <TradeCard trade={t} timeZone={tz} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
