import type { Metadata } from "next";

import { StatsView } from "@/components/stats/stats-view";
import { getFilter, type SearchParams } from "@/lib/filter-server";
import { getSettings } from "@/lib/settings";
import { currencyScope, equityCurve, loadClosedTrades } from "@/lib/stats/queries";
import { buildReport } from "@/lib/stats/report";

export const metadata: Metadata = { title: "Statistiken" };

export default async function StatsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const settings = getSettings();
  const params = await searchParams;
  const filter = await getFilter(params);
  const scope = currencyScope(filter, settings.baseCurrency);
  const ids = scope.accounts.map((a) => a.id);
  const closed = loadClosedTrades(filter, { accountIds: ids });
  const curve = equityCurve(filter, ids, closed);
  const report = buildReport(closed, curve, settings.displayTimezone);
  return (
    <div className="flex flex-col gap-3">
      {scope.others.length > 0 ? (
        <p className="text-small text-muted-foreground">
          Auswertung in {scope.currency}. Konten in anderen Währungen werden separat angezeigt.
        </p>
      ) : null}
      <StatsView
        report={report}
        curve={curve}
        currency={scope.currency}
        timeZone={settings.displayTimezone}
        tradeCount={closed.length}
        initialTab={typeof params.tab === "string" ? params.tab : "overview"}
      />
    </div>
  );
}
