import type { TradeResult } from "@/lib/db/schema";

/** Minimal closed-trade shape used by all pure statistics functions. */
export type StatTrade = {
  id: string;
  netPnl: number;
  rMultiple: number | null;
  result: TradeResult;
  closedAt: number;
  openedAt: number;
  holdMinutes: number | null;
  /** Rules checked / total rules of the trade's playbook; null when the trade has no playbook. */
  rules?: { checked: number; total: number } | null;
};

export type Streak = { type: "win" | "loss" | null; length: number };

export type Metrics = {
  netPnl: number;
  trades: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  payoffRatio: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  expectancyR: number | null;
  totalR: number;
  tradesWithR: number;
  best: number | null;
  worst: number | null;
  avgHoldMinutes: number | null;
  longestWinStreak: number;
  longestLossStreak: number;
  currentStreak: Streak;
  rulesFollowed: number | null;
  grossProfit: number;
  grossLoss: number;
};

function mean(values: number[]) {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function sortByClose<T extends { closedAt: number }>(trades: T[]) {
  return [...trades].sort((a, b) => a.closedAt - b.closedAt);
}

/** Win rate = wins / (wins + losses); break-even trades are excluded. */
export function winRate(trades: Pick<StatTrade, "result">[]): number | null {
  const wins = trades.filter((t) => t.result === "win").length;
  const losses = trades.filter((t) => t.result === "loss").length;
  return wins + losses > 0 ? wins / (wins + losses) : null;
}

/** Σ wins / |Σ losses|; ∞ when there are wins but no losses, null when there is nothing to compare. */
export function profitFactor(trades: Pick<StatTrade, "result" | "netPnl">[]): number | null {
  const grossProfit = trades.filter((t) => t.result === "win").reduce((a, t) => a + t.netPnl, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.result === "loss").reduce((a, t) => a + t.netPnl, 0));
  if (grossLoss === 0) return grossProfit > 0 ? Number.POSITIVE_INFINITY : null;
  return grossProfit / grossLoss;
}

/** Consecutive wins / losses ordered by close time. Break-even trades neither break nor extend a streak. */
export function streaks(trades: Pick<StatTrade, "result" | "closedAt">[]) {
  let longestWin = 0;
  let longestLoss = 0;
  let current: Streak = { type: null, length: 0 };
  for (const t of sortByClose(trades)) {
    if (t.result !== "win" && t.result !== "loss") continue;
    if (current.type === t.result) current = { type: t.result, length: current.length + 1 };
    else current = { type: t.result, length: 1 };
    if (current.type === "win") longestWin = Math.max(longestWin, current.length);
    else longestLoss = Math.max(longestLoss, current.length);
  }
  return { longestWin, longestLoss, current };
}

export function computeMetrics(trades: StatTrade[]): Metrics {
  const wins = trades.filter((t) => t.result === "win");
  const losses = trades.filter((t) => t.result === "loss");
  const breakEven = trades.filter((t) => t.result === "be");
  const netPnl = trades.reduce((a, t) => a + t.netPnl, 0);
  const grossProfit = wins.reduce((a, t) => a + t.netPnl, 0);
  const grossLoss = losses.reduce((a, t) => a + t.netPnl, 0);
  const avgWin = mean(wins.map((t) => t.netPnl));
  const avgLoss = mean(losses.map((t) => t.netPnl));
  const rs = trades.map((t) => t.rMultiple).filter((r): r is number => r != null);
  const holds = trades.map((t) => t.holdMinutes).filter((h): h is number => h != null);
  const streak = streaks(trades);
  const ruleTrades = trades.filter((t) => t.rules && t.rules.total > 0);
  const rulesTotal = ruleTrades.reduce((a, t) => a + (t.rules?.total ?? 0), 0);
  const rulesChecked = ruleTrades.reduce((a, t) => a + (t.rules?.checked ?? 0), 0);

  return {
    netPnl,
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakEven: breakEven.length,
    winRate: winRate(trades),
    avgWin,
    avgLoss,
    payoffRatio: avgWin != null && avgLoss != null && avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : null,
    profitFactor: profitFactor(trades),
    expectancy: trades.length > 0 ? netPnl / trades.length : null,
    expectancyR: mean(rs),
    totalR: rs.reduce((a, r) => a + r, 0),
    tradesWithR: rs.length,
    best: trades.length > 0 ? Math.max(...trades.map((t) => t.netPnl)) : null,
    worst: trades.length > 0 ? Math.min(...trades.map((t) => t.netPnl)) : null,
    avgHoldMinutes: mean(holds),
    longestWinStreak: streak.longestWin,
    longestLossStreak: streak.longestLoss,
    currentStreak: streak.current,
    rulesFollowed: rulesTotal > 0 ? rulesChecked / rulesTotal : null,
    grossProfit,
    grossLoss,
  };
}

export type CashEvent = { occurredAt: number; type: "deposit" | "withdrawal" | "fee" | "payout"; amount: number };

/** Signed effect of a cash transaction on the balance: deposit +, withdrawal −, fee −, payout −. */
export function cashDelta(event: Pick<CashEvent, "type" | "amount">) {
  return event.type === "deposit" ? Math.abs(event.amount) : -Math.abs(event.amount);
}

export type CurvePoint = { ts: number; balance: number; tradePnl: number | null; tradeId: string | null };

/**
 * Balance curve: starting balance + cash transactions + cumulative net P&L ordered by close time.
 * The first point is the starting balance at `startTs` (or the first event).
 */
export function balanceCurve(
  startingBalance: number,
  cash: CashEvent[],
  trades: Pick<StatTrade, "id" | "netPnl" | "closedAt">[],
  startTs?: number,
): CurvePoint[] {
  type Ev = { ts: number; delta: number; trade: boolean; id: string | null; order: number };
  const events: Ev[] = [
    ...cash.map((c) => ({ ts: c.occurredAt, delta: cashDelta(c), trade: false, id: null, order: 0 })),
    ...trades.map((t) => ({ ts: t.closedAt, delta: t.netPnl, trade: true, id: t.id, order: 1 })),
  ].sort((a, b) => a.ts - b.ts || a.order - b.order);
  const firstTs = startTs ?? (events.length > 0 ? events[0].ts : Date.now());
  const points: CurvePoint[] = [{ ts: firstTs, balance: startingBalance, tradePnl: null, tradeId: null }];
  let balance = startingBalance;
  for (const e of events) {
    balance += e.delta;
    points.push({ ts: e.ts, balance, tradePnl: e.trade ? e.delta : null, tradeId: e.id });
  }
  return points;
}

export type Drawdown = { amount: number; percent: number | null; peakTs: number | null; troughTs: number | null };

/** Largest peak-to-trough drop on a balance curve, in money and in % of the peak. */
export function maxDrawdown(points: Pick<CurvePoint, "ts" | "balance">[]): Drawdown {
  let peak = Number.NEGATIVE_INFINITY;
  let peakTs: number | null = null;
  let best: Drawdown = { amount: 0, percent: null, peakTs: null, troughTs: null };
  for (const p of points) {
    if (p.balance > peak) {
      peak = p.balance;
      peakTs = p.ts;
    }
    const drop = peak - p.balance;
    if (drop > best.amount) {
      best = { amount: drop, percent: peak > 0 ? drop / peak : null, peakTs, troughTs: p.ts };
    }
  }
  return best;
}

/** Underwater series (drawdown at each point, ≤ 0) for the drawdown chart. */
export function underwater(points: Pick<CurvePoint, "ts" | "balance">[]) {
  let peak = Number.NEGATIVE_INFINITY;
  return points.map((p) => {
    peak = Math.max(peak, p.balance);
    const dd = p.balance - peak;
    return { ts: p.ts, drawdown: dd, percent: peak > 0 ? dd / peak : 0 };
  });
}

export const R_BUCKETS = ["≤ −2", "−2…−1", "−1…0", "0…1", "1…2", "2…3", "≥ 3"] as const;

/**
 * Bucket index for an R multiple. Negative buckets are upper-inclusive and positive buckets lower-inclusive,
 * so a full −1R stop counts into "−2…−1" and a +1R target into "1…2" (symmetric around zero).
 */
export function rBucketIndex(r: number) {
  if (r <= -2) return 0;
  if (r <= -1) return 1;
  if (r < 0) return 2;
  if (r < 1) return 3;
  if (r < 2) return 4;
  if (r < 3) return 5;
  return 6;
}

export function rHistogram(rs: number[]) {
  const counts = R_BUCKETS.map((label) => ({ label, count: 0 }));
  for (const r of rs) counts[rBucketIndex(r)].count += 1;
  return { buckets: counts, mean: mean(rs), median: median(rs) };
}

export const HOLD_BUCKETS = ["< 5 min", "5–30 min", "30 min–2 h", "2–8 h", "> 8 h"] as const;

export function holdBucketIndex(minutes: number) {
  if (minutes < 5) return 0;
  if (minutes < 30) return 1;
  if (minutes < 120) return 2;
  if (minutes < 480) return 3;
  return 4;
}

export type GroupSummary = {
  key: string;
  trades: number;
  netPnl: number;
  winRate: number | null;
  profitFactor: number | null;
  expectancyR: number | null;
  totalR: number;
  rulesFollowed: number | null;
  wins: number;
  losses: number;
};

/** Groups trades by a key and summarises each group. */
export function groupBy<T extends StatTrade>(trades: T[], keyOf: (t: T) => string | null): Map<string, GroupSummary> {
  const groups = new Map<string, T[]>();
  for (const t of trades) {
    const key = keyOf(t);
    if (key == null) continue;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }
  const out = new Map<string, GroupSummary>();
  for (const [key, list] of groups) {
    const m = computeMetrics(list);
    out.set(key, {
      key,
      trades: m.trades,
      netPnl: m.netPnl,
      winRate: m.winRate,
      profitFactor: m.profitFactor,
      expectancyR: m.expectancyR,
      totalR: m.totalR,
      rulesFollowed: m.rulesFollowed,
      wins: m.wins,
      losses: m.losses,
    });
  }
  return out;
}
