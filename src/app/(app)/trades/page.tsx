import type { Metadata } from "next";

import { TradesView } from "@/components/trades/trades-view";
import { listMistakes, listPlaybooksWithRules, listTags, listTrades } from "@/lib/db/queries";
import { getFilter, type SearchParams } from "@/lib/filter-server";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Trades" };

export default async function TradesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filter = await getFilter(await searchParams);
  const rows = listTrades(filter);
  const settings = getSettings();
  const symbols = Array.from(new Set(rows.map((r) => r.symbol))).sort();
  return (
    <TradesView
      rows={rows}
      compact={settings.compactTables}
      options={{
        symbols,
        playbooks: listPlaybooksWithRules({ includeArchived: true }).map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
        })),
        tags: listTags().map((t) => ({ id: t.id, name: t.name, color: t.color ?? "#9AA3B5" })),
        mistakes: listMistakes().map((m) => ({ id: m.id, name: m.name })),
      }}
    />
  );
}
