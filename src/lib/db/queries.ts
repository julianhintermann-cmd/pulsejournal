import { and, asc, desc, eq, isNull, like, or } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { accounts, instruments, trades } from "@/lib/db/schema";

export function listAccounts(opts: { includeArchived?: boolean } = {}) {
  const db = getDb();
  return db
    .select()
    .from(accounts)
    .where(opts.includeArchived ? undefined : eq(accounts.archived, false))
    .orderBy(asc(accounts.createdAt))
    .all();
}

export type TradeSearchHit = {
  id: string;
  symbol: string;
  direction: "long" | "short";
  openedAt: number;
  netPnl: number | null;
  rMultiple: number | null;
  result: "win" | "loss" | "be" | "open";
  currency: string;
};

/** Command-palette search over symbol and notes. */
export function searchTrades(query: string, limit = 8): TradeSearchHit[] {
  const q = query.trim();
  if (q.length === 0) return [];
  const pattern = `%${q}%`;
  return getDb()
    .select({
      id: trades.id,
      symbol: instruments.symbol,
      direction: trades.direction,
      openedAt: trades.openedAt,
      netPnl: trades.netPnl,
      rMultiple: trades.rMultiple,
      result: trades.result,
      currency: accounts.currency,
    })
    .from(trades)
    .innerJoin(instruments, eq(instruments.id, trades.instrumentId))
    .innerJoin(accounts, eq(accounts.id, trades.accountId))
    .where(
      and(isNull(trades.deletedAt), or(like(instruments.symbol, pattern.toUpperCase()), like(trades.notes, pattern))),
    )
    .orderBy(desc(trades.openedAt))
    .limit(limit)
    .all();
}
