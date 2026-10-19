import { and, asc, desc, eq, inArray, isNull, lt } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { filterConditions } from "@/lib/db/queries";
import {
  accounts,
  cashTransactions,
  instruments,
  playbookRules,
  playbooks,
  tradeMistakes,
  tradeRuleChecks,
  trades,
  type Account,
} from "@/lib/db/schema";
import type { ResolvedFilter } from "@/lib/filter";
import { dayKey } from "@/lib/format";
import { balanceCurve, cashDelta, type StatTrade } from "@/lib/stats/metrics";

export type StatRow = StatTrade & {
  accountId: string;
  currency: string;
  symbol: string;
  direction: "long" | "short";
  session: "asia" | "london" | "newyork" | "off";
  playbookId: string | null;
  emotionBefore: string | null;
  confidence: number | null;
  executionRating: number | null;
  mistakeIds: string[];
};

type FilterLike = Pick<ResolvedFilter, "start" | "end" | "accountId">;

/** Closed, non-deleted trades whose close time falls into the filter period. */
export function loadClosedTrades(filter: FilterLike, opts: { accountIds?: string[] } = {}): StatRow[] {
  const db = getDb();
  const conditions = [...filterConditions(filter, "closedAt"), eq(trades.status, "closed")];
  if (opts.accountIds) {
    if (opts.accountIds.length === 0) return [];
    conditions.push(inArray(trades.accountId, opts.accountIds));
  }
  const rows = db
    .select({
      id: trades.id,
      netPnl: trades.netPnl,
      rMultiple: trades.rMultiple,
      result: trades.result,
      closedAt: trades.closedAt,
      openedAt: trades.openedAt,
      holdMinutes: trades.holdMinutes,
      accountId: trades.accountId,
      currency: accounts.currency,
      symbol: instruments.symbol,
      direction: trades.direction,
      session: trades.session,
      playbookId: trades.playbookId,
      emotionBefore: trades.emotionBefore,
      confidence: trades.confidence,
      executionRating: trades.executionRating,
    })
    .from(trades)
    .innerJoin(accounts, eq(accounts.id, trades.accountId))
    .innerJoin(instruments, eq(instruments.id, trades.instrumentId))
    .where(and(...conditions))
    .orderBy(asc(trades.closedAt))
    .all();
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const ruleCount = new Map<string, number>();
  for (const r of db.select({ playbookId: playbookRules.playbookId }).from(playbookRules).all()) {
    ruleCount.set(r.playbookId, (ruleCount.get(r.playbookId) ?? 0) + 1);
  }
  const checked = new Map<string, number>();
  const checkRows = db
    .select({ tradeId: tradeRuleChecks.tradeId, ruleId: tradeRuleChecks.ruleId, playbookId: playbookRules.playbookId })
    .from(tradeRuleChecks)
    .innerJoin(playbookRules, eq(playbookRules.id, tradeRuleChecks.ruleId))
    .where(and(eq(tradeRuleChecks.checked, true), inArray(tradeRuleChecks.tradeId, ids)))
    .all();
  const playbookOf = new Map(rows.map((r) => [r.id, r.playbookId]));
  for (const c of checkRows) {
    if (playbookOf.get(c.tradeId) === c.playbookId) checked.set(c.tradeId, (checked.get(c.tradeId) ?? 0) + 1);
  }
  const mistakesByTrade = new Map<string, string[]>();
  for (const m of db.select().from(tradeMistakes).where(inArray(tradeMistakes.tradeId, ids)).all()) {
    mistakesByTrade.set(m.tradeId, [...(mistakesByTrade.get(m.tradeId) ?? []), m.mistakeId]);
  }

  return rows.map((r) => ({
    ...r,
    netPnl: r.netPnl ?? 0,
    closedAt: r.closedAt ?? r.openedAt,
    rules: r.playbookId ? { checked: checked.get(r.id) ?? 0, total: ruleCount.get(r.playbookId) ?? 0 } : null,
    mistakeIds: mistakesByTrade.get(r.id) ?? [],
  }));
}

export type CurrencyScope = {
  currency: string;
  accounts: Account[];
  /** Net P&L in the period of accounts that are not in `currency` (shown separately). */
  others: { currency: string; netPnl: number; trades: number }[];
};

/**
 * Which accounts the money KPIs cover (section 8.1): the selected account, or – for "Alle Konten" – all
 * accounts in the base currency. Accounts in other currencies are summarised separately.
 */
export function currencyScope(filter: FilterLike, baseCurrency: string): CurrencyScope {
  const db = getDb();
  const all = db.select().from(accounts).orderBy(asc(accounts.createdAt)).all();
  if (filter.accountId) {
    const account = all.find((a) => a.id === filter.accountId);
    if (account) return { currency: account.currency, accounts: [account], others: [] };
  }
  const active = all.filter((a) => !a.archived || filter.accountId === a.id);
  const pool = active.length > 0 ? active : all;
  let currency = baseCurrency;
  if (!pool.some((a) => a.currency === baseCurrency) && pool.length > 0) {
    // No account in the base currency: fall back to the most common account currency.
    const counts = new Map<string, number>();
    for (const a of pool) counts.set(a.currency, (counts.get(a.currency) ?? 0) + 1);
    currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  const inScope = all.filter((a) => a.currency === currency);
  const otherIds = all.filter((a) => a.currency !== currency).map((a) => a.id);
  const othersMap = new Map<string, { netPnl: number; trades: number }>();
  if (otherIds.length > 0) {
    for (const t of loadClosedTrades(filter, { accountIds: otherIds })) {
      const entry = othersMap.get(t.currency) ?? { netPnl: 0, trades: 0 };
      entry.netPnl += t.netPnl;
      entry.trades += 1;
      othersMap.set(t.currency, entry);
    }
  }
  return {
    currency,
    accounts: inScope,
    others: [...othersMap.entries()].map(([c, v]) => ({ currency: c, ...v })),
  };
}

/** Balance of the scope accounts right before `ts` (starting balances + cash + closed P&L). */
export function balanceBefore(accountIds: string[], ts: number | null) {
  const db = getDb();
  if (accountIds.length === 0) return 0;
  const acc = db.select().from(accounts).where(inArray(accounts.id, accountIds)).all();
  let balance = acc.reduce((a, x) => a + x.startingBalance, 0);
  if (ts == null) return balance;
  const cash = db
    .select()
    .from(cashTransactions)
    .where(and(inArray(cashTransactions.accountId, accountIds), lt(cashTransactions.occurredAt, ts)))
    .all();
  balance += cash.reduce((a, c) => a + cashDelta(c), 0);
  const prior = db
    .select({ netPnl: trades.netPnl })
    .from(trades)
    .where(
      and(
        inArray(trades.accountId, accountIds),
        isNull(trades.deletedAt),
        eq(trades.status, "closed"),
        lt(trades.closedAt, ts),
      ),
    )
    .all();
  balance += prior.reduce((a, t) => a + (t.netPnl ?? 0), 0);
  return balance;
}

export type EquityPoint = { ts: number; balance: number; tradePnl: number | null };

/** Balance curve over the filter period for the given accounts (includes cash transactions in the period). */
export function equityCurve(filter: FilterLike, accountIds: string[], closed: StatRow[]): EquityPoint[] {
  const db = getDb();
  if (accountIds.length === 0) return [];
  const start = filter.start ?? null;
  const startBalance = start != null ? balanceBefore(accountIds, start) : balanceBefore(accountIds, null);
  const cashConditions = [inArray(cashTransactions.accountId, accountIds)];
  const cash = db
    .select()
    .from(cashTransactions)
    .where(and(...cashConditions))
    .all()
    .filter((c) => (start == null || c.occurredAt >= start) && (filter.end == null || c.occurredAt < filter.end));
  const own = closed.filter((t) => accountIds.includes(t.accountId));
  const firstTs =
    start ??
    Math.min(
      ...[...own.map((t) => t.closedAt), ...cash.map((c) => c.occurredAt)].concat(
        own.length === 0 && cash.length === 0 ? [Date.now()] : [],
      ),
    ) - 1;
  return balanceCurve(startBalance, cash, own, firstTs).map((p) => ({
    ts: p.ts,
    balance: p.balance,
    tradePnl: p.tradePnl,
  }));
}

export type DailyPnl = { day: string; netPnl: number; trades: number };

export function dailyPnl(closed: StatRow[], timeZone: string): DailyPnl[] {
  const map = new Map<string, DailyPnl>();
  for (const t of closed) {
    const day = dayKey(t.closedAt, timeZone);
    const entry = map.get(day) ?? { day, netPnl: 0, trades: 0 };
    entry.netPnl += t.netPnl;
    entry.trades += 1;
    map.set(day, entry);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function playbookNames() {
  return getDb()
    .select({ id: playbooks.id, name: playbooks.name, color: playbooks.color, archived: playbooks.archived })
    .from(playbooks)
    .all();
}

/** Last N trades (open or closed) in the filter, newest first. */
export function recentTrades(filter: FilterLike, limit = 8) {
  return getDb()
    .select({
      id: trades.id,
      symbol: instruments.symbol,
      direction: trades.direction,
      rMultiple: trades.rMultiple,
      netPnl: trades.netPnl,
      result: trades.result,
      openedAt: trades.openedAt,
      closedAt: trades.closedAt,
      currency: accounts.currency,
    })
    .from(trades)
    .innerJoin(instruments, eq(instruments.id, trades.instrumentId))
    .innerJoin(accounts, eq(accounts.id, trades.accountId))
    .where(and(...filterConditions(filter, "openedAt")))
    .orderBy(desc(trades.openedAt))
    .limit(limit)
    .all();
}
