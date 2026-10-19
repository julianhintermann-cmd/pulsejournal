import { and, asc, desc, eq, gt, gte, isNull, like, lt, or, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  accounts,
  cashTransactions,
  emotions,
  executions,
  instruments,
  mistakes,
  playbookRules,
  playbooks,
  screenshots,
  tags,
  tradeMistakes,
  tradeRuleChecks,
  trades,
  tradeTags,
  type Account,
  type CashTransaction,
  type Instrument,
} from "@/lib/db/schema";
import type { ResolvedFilter } from "@/lib/filter";
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

// ---------- Trade form ----------

export type FormInstrument = { id: string; symbol: string; multiplier: number; quoteCurrency: string };
export type FormPlaybook = { id: string; name: string; color: string; rules: { id: string; text: string }[] };

export function listPlaybooksWithRules(opts: { includeArchived?: boolean } = {}): FormPlaybook[] {
  const db = getDb();
  const rows = db
    .select()
    .from(playbooks)
    .where(opts.includeArchived ? undefined : eq(playbooks.archived, false))
    .orderBy(asc(playbooks.name))
    .all();
  const rules = db.select().from(playbookRules).orderBy(asc(playbookRules.position)).all();
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    rules: rules.filter((r) => r.playbookId === p.id).map((r) => ({ id: r.id, text: r.text })),
  }));
}

export function tradeFormData() {
  const db = getDb();
  const instrumentRows = db
    .select({
      id: instruments.id,
      symbol: instruments.symbol,
      multiplier: instruments.multiplier,
      quoteCurrency: instruments.quoteCurrency,
    })
    .from(instruments)
    .orderBy(asc(instruments.symbol))
    .all();
  const recent = db
    .select({ symbol: instruments.symbol, last: sql<number>`max(${trades.openedAt})` })
    .from(trades)
    .innerJoin(instruments, eq(instruments.id, trades.instrumentId))
    .groupBy(instruments.id)
    .orderBy(desc(sql`max(${trades.openedAt})`))
    .limit(12)
    .all()
    .map((r) => r.symbol);
  const accountRows = listAccounts().map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    balance: accountBalance(a.id) ?? a.startingBalance,
  }));
  return {
    accounts: accountRows,
    instruments: instrumentRows as FormInstrument[],
    recentSymbols: recent,
    playbooks: listPlaybooksWithRules(),
    emotions: db.select({ id: emotions.id, name: emotions.name }).from(emotions).orderBy(asc(emotions.position)).all(),
    mistakes: db.select({ id: mistakes.id, name: mistakes.name }).from(mistakes).orderBy(asc(mistakes.position)).all(),
    tags: db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).orderBy(asc(tags.name)).all(),
  };
}
export type TradeFormData = ReturnType<typeof tradeFormData>;

export type TradeDetail = NonNullable<ReturnType<typeof getTradeDetail>>;

/** Everything needed by the detail and edit pages. */
export function getTradeDetail(id: string) {
  const db = getDb();
  const row = db
    .select({ trade: trades, instrument: instruments, account: accounts })
    .from(trades)
    .innerJoin(instruments, eq(instruments.id, trades.instrumentId))
    .innerJoin(accounts, eq(accounts.id, trades.accountId))
    .where(and(eq(trades.id, id), isNull(trades.deletedAt)))
    .get();
  if (!row) return null;
  const playbook = row.trade.playbookId
    ? (db.select().from(playbooks).where(eq(playbooks.id, row.trade.playbookId)).get() ?? null)
    : null;
  const rules = playbook
    ? db
        .select()
        .from(playbookRules)
        .where(eq(playbookRules.playbookId, playbook.id))
        .orderBy(asc(playbookRules.position))
        .all()
    : [];
  const checks = db.select().from(tradeRuleChecks).where(eq(tradeRuleChecks.tradeId, id)).all();
  return {
    ...row,
    playbook,
    rules: rules.map((r) => ({ id: r.id, text: r.text, checked: checks.some((c) => c.ruleId === r.id && c.checked) })),
    executions: db
      .select()
      .from(executions)
      .where(eq(executions.tradeId, id))
      .orderBy(asc(executions.executedAt))
      .all(),
    tags: db
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(tradeTags)
      .innerJoin(tags, eq(tags.id, tradeTags.tagId))
      .where(eq(tradeTags.tradeId, id))
      .orderBy(asc(tags.name))
      .all(),
    mistakes: db
      .select({ id: mistakes.id, name: mistakes.name })
      .from(tradeMistakes)
      .innerJoin(mistakes, eq(mistakes.id, tradeMistakes.mistakeId))
      .where(eq(tradeMistakes.tradeId, id))
      .orderBy(asc(mistakes.position))
      .all(),
    screenshots: db
      .select()
      .from(screenshots)
      .where(eq(screenshots.tradeId, id))
      .orderBy(asc(screenshots.position))
      .all(),
  };
}

// ---------- Filters ----------

/** SQL conditions for the global filter. `field` decides which timestamp the period applies to. */
export function filterConditions(
  filter: Pick<ResolvedFilter, "start" | "end" | "accountId">,
  field: "openedAt" | "closedAt" = "openedAt",
) {
  const column = field === "openedAt" ? trades.openedAt : trades.closedAt;
  const conditions: SQL[] = [isNull(trades.deletedAt)];
  if (filter.accountId) conditions.push(eq(trades.accountId, filter.accountId));
  if (filter.start != null) conditions.push(gte(column, filter.start));
  if (filter.end != null) conditions.push(lt(column, filter.end));
  return conditions;
}

/** Previous / next trade (by opened_at) within the current filter. */
export function adjacentTrades(
  id: string,
  openedAt: number,
  filter: Pick<ResolvedFilter, "start" | "end" | "accountId">,
) {
  const db = getDb();
  const base = filterConditions(filter, "openedAt");
  const prev = db
    .select({ id: trades.id })
    .from(trades)
    .where(and(...base, or(lt(trades.openedAt, openedAt), and(eq(trades.openedAt, openedAt), lt(trades.id, id)))))
    .orderBy(desc(trades.openedAt), desc(trades.id))
    .limit(1)
    .get();
  const next = db
    .select({ id: trades.id })
    .from(trades)
    .where(and(...base, or(gt(trades.openedAt, openedAt), and(eq(trades.openedAt, openedAt), gt(trades.id, id)))))
    .orderBy(asc(trades.openedAt), asc(trades.id))
    .limit(1)
    .get();
  return { prevId: prev?.id ?? null, nextId: next?.id ?? null };
}
