import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { listPlaybooksWithRules } from "@/lib/db/queries";
import { playbooks, screenshots, trades } from "@/lib/db/schema";
import type { ResolvedFilter } from "@/lib/filter";
import { computeMetrics } from "@/lib/stats/metrics";
import { loadClosedTrades } from "@/lib/stats/queries";

type FilterLike = Pick<ResolvedFilter, "start" | "end" | "accountId">;

export type PlaybookCardData = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  description: string | null;
  rules: { id: string; text: string }[];
  trades: number;
  winRate: number | null;
  totalR: number;
  rCurve: number[];
};

/** Playbook cards: metrics over closed trades in the filter (R-based, currency independent). */
export function playbookCards(filter: FilterLike, includeArchived: boolean): PlaybookCardData[] {
  const db = getDb();
  const rows = db
    .select()
    .from(playbooks)
    .where(includeArchived ? undefined : eq(playbooks.archived, false))
    .orderBy(asc(playbooks.name))
    .all();
  const withRules = new Map(listPlaybooksWithRules({ includeArchived: true }).map((p) => [p.id, p.rules]));
  const closed = loadClosedTrades(filter);
  return rows.map((p) => {
    const own = closed.filter((t) => t.playbookId === p.id);
    const m = computeMetrics(own);
    let cum = 0;
    const rCurve = [0, ...own.map((t) => (cum += t.rMultiple ?? 0))];
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      archived: p.archived,
      description: p.description,
      rules: withRules.get(p.id) ?? [],
      trades: m.trades,
      winRate: m.winRate,
      totalR: m.totalR,
      rCurve,
    };
  });
}

export function getPlaybook(id: string) {
  const row = getDb().select().from(playbooks).where(eq(playbooks.id, id)).get();
  if (!row) return null;
  const rules = listPlaybooksWithRules({ includeArchived: true }).find((p) => p.id === id)?.rules ?? [];
  return { ...row, rules };
}

/** First screenshot of the playbook's best trades by R ("Beste Beispiele"). */
export function bestExamples(playbookId: string, limit = 6) {
  const db = getDb();
  const best = db
    .select({ id: trades.id, rMultiple: trades.rMultiple })
    .from(trades)
    .where(and(eq(trades.playbookId, playbookId), eq(trades.status, "closed"), isNotNull(trades.rMultiple)))
    .orderBy(desc(trades.rMultiple))
    .all();
  if (best.length === 0) return [];
  const shots = db
    .select()
    .from(screenshots)
    .where(
      inArray(
        screenshots.tradeId,
        best.map((b) => b.id),
      ),
    )
    .orderBy(asc(screenshots.position))
    .all();
  const out: { tradeId: string; rMultiple: number; shot: (typeof shots)[number] }[] = [];
  for (const b of best) {
    const shot = shots.find((s) => s.tradeId === b.id);
    if (shot) out.push({ tradeId: b.id, rMultiple: b.rMultiple ?? 0, shot });
    if (out.length >= limit) break;
  }
  return out;
}
