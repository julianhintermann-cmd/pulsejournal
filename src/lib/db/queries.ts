import { and, asc, desc, eq, isNull, like, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  accounts,
  cashTransactions,
  emotions,
  instruments,
  mistakes,
  tags,
  tradeMistakes,
  trades,
  tradeTags,
  type Account,
  type CashTransaction,
  type Instrument,
} from "@/lib/db/schema";
import { balanceCurve, cashDelta } from "@/lib/stats/metrics";

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

// ---------- Accounts ----------

export type AccountSummary = Account & {
  balance: number;
  netPnl: number;
  cashNet: number;
  trades: number;
  returnPct: number | null;
  curve: number[];
  cash: CashTransaction[];
};

/** Downsamples a series to at most `max` points (keeps first and last). */
export function downsample(values: number[], max = 60) {
  if (values.length <= max) return values;
  const step = (values.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => values[Math.round(i * step)]);
}

export function accountSummaries(opts: { includeArchived?: boolean } = {}): AccountSummary[] {
  const db = getDb();
  const list = listAccounts(opts);
  const closed = db
    .select({ accountId: trades.accountId, id: trades.id, netPnl: trades.netPnl, closedAt: trades.closedAt })
    .from(trades)
    .where(and(isNull(trades.deletedAt), eq(trades.status, "closed")))
    .orderBy(asc(trades.closedAt))
    .all();
  const cashRows = db.select().from(cashTransactions).orderBy(desc(cashTransactions.occurredAt)).all();

  return list.map((account) => {
    const own = closed
      .filter((t) => t.accountId === account.id && t.closedAt != null)
      .map((t) => ({ id: t.id, netPnl: t.netPnl ?? 0, closedAt: t.closedAt as number }));
    const cash = cashRows.filter((c) => c.accountId === account.id);
    const netPnl = own.reduce((a, t) => a + t.netPnl, 0);
    const cashNet = cash.reduce((a, c) => a + cashDelta(c), 0);
    const curve = balanceCurve(account.startingBalance, cash, own, account.createdAt).map((p) => p.balance);
    return {
      ...account,
      balance: account.startingBalance + cashNet + netPnl,
      netPnl,
      cashNet,
      trades: own.length,
      returnPct: account.startingBalance > 0 ? netPnl / account.startingBalance : null,
      curve: downsample(curve),
      cash,
    };
  });
}

export function getAccount(id: string) {
  return getDb().select().from(accounts).where(eq(accounts.id, id)).get() ?? null;
}

/** Current balance of one account (starting balance + cash transactions + Σ closed net P&L). */
export function accountBalance(accountId: string) {
  const db = getDb();
  const account = getAccount(accountId);
  if (!account) return null;
  const [{ pnl }] = db
    .select({ pnl: sql<number>`coalesce(sum(${trades.netPnl}), 0)` })
    .from(trades)
    .where(and(eq(trades.accountId, accountId), isNull(trades.deletedAt), eq(trades.status, "closed")))
    .all();
  const cash = db.select().from(cashTransactions).where(eq(cashTransactions.accountId, accountId)).all();
  return account.startingBalance + cash.reduce((a, c) => a + cashDelta(c), 0) + pnl;
}

// ---------- Lists ----------

export type ListItem = { id: string; name: string; count: number; color?: string };

export function listTags(): ListItem[] {
  const db = getDb();
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color, count: sql<number>`count(${tradeTags.tradeId})` })
    .from(tags)
    .leftJoin(tradeTags, eq(tradeTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(asc(sql`lower(${tags.name})`))
    .all();
}

export function listMistakes(): ListItem[] {
  return getDb()
    .select({ id: mistakes.id, name: mistakes.name, count: sql<number>`count(${tradeMistakes.tradeId})` })
    .from(mistakes)
    .leftJoin(tradeMistakes, eq(tradeMistakes.mistakeId, mistakes.id))
    .groupBy(mistakes.id)
    .orderBy(asc(mistakes.position), asc(mistakes.name))
    .all();
}

export function listEmotions(): ListItem[] {
  const db = getDb();
  const rows = db.select().from(emotions).orderBy(asc(emotions.position), asc(emotions.name)).all();
  const usage = db.select({ name: trades.emotionBefore, after: trades.emotionAfter }).from(trades).all();
  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    count: usage.filter((u) => u.name === e.name || u.after === e.name).length,
  }));
}

export type InstrumentItem = Instrument & { count: number };

export function listInstruments(): InstrumentItem[] {
  return getDb()
    .select({
      id: instruments.id,
      symbol: instruments.symbol,
      assetClass: instruments.assetClass,
      multiplier: instruments.multiplier,
      quoteCurrency: instruments.quoteCurrency,
      tickSize: instruments.tickSize,
      createdAt: instruments.createdAt,
      count: sql<number>`count(${trades.id})`,
    })
    .from(instruments)
    .leftJoin(trades, eq(trades.instrumentId, instruments.id))
    .groupBy(instruments.id)
    .orderBy(asc(instruments.symbol))
    .all();
}
