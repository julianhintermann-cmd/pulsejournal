import type { Direction, PnlMode, Side, TradeResult } from "@/lib/db/schema";

export const CALC_ERRORS = {
  qtyClosedExceeds: "Geschlossene Menge ist grösser als die eröffnete Menge.",
  stopWrongSide: "Stop Loss liegt auf der falschen Seite des Einstiegs.",
} as const;

export type ExecutionInput = {
  side: Side;
  qty: number;
  price: number;
  fee: number;
  executedAt: number;
};

export type TradeCalcInput = {
  direction: Direction;
  executions: ExecutionInput[];
  /** Money per 1.0 price move per 1 unit of quantity. */
  multiplier: number;
  /** Quote currency → account currency. */
  fxRate: number;
  /** Extra trade fees in account currency. */
  fees: number;
  /** Signed swap in account currency. */
  swap: number;
  pnlMode: PnlMode;
  manualNetPnl: number | null;
  initialStop: number | null;
  /** Absolute break-even threshold in account currency. */
  beThreshold: number;
};

export type TradeCalcResult = {
  qtyOpened: number;
  qtyClosed: number;
  entryAvg: number | null;
  exitAvg: number | null;
  status: "open" | "closed";
  openedAt: number | null;
  closedAt: number | null;
  grossPnl: number | null;
  netPnl: number | null;
  initialRisk: number | null;
  rMultiple: number | null;
  result: TradeResult;
  holdMinutes: number | null;
  totalFees: number;
};

export type CalcIssue = { field: "executions" | "initialStop"; message: string };

const EPSILON = 1e-9;

/** True when the execution opens a position for the given trade direction (long: buy, short: sell). */
export function isOpeningSide(direction: Direction, side: Side) {
  return direction === "long" ? side === "buy" : side === "sell";
}

export function openingSide(direction: Direction): Side {
  return direction === "long" ? "buy" : "sell";
}

export function closingSide(direction: Direction): Side {
  return direction === "long" ? "sell" : "buy";
}

function sum(values: number[]) {
  return values.reduce((acc, v) => acc + v, 0);
}

/** Volume-weighted average price; null when there is no quantity. */
export function weightedAverage(rows: { qty: number; price: number }[]): number | null {
  const qty = sum(rows.map((r) => r.qty));
  if (qty <= 0) return null;
  return sum(rows.map((r) => r.qty * r.price)) / qty;
}

/** Collects every validation problem of section 6 (quantities and stop side). */
export function validateTradeCalc(input: TradeCalcInput): CalcIssue[] {
  const issues: CalcIssue[] = [];
  const opening = input.executions.filter((e) => isOpeningSide(input.direction, e.side));
  const closing = input.executions.filter((e) => !isOpeningSide(input.direction, e.side));
  const qtyOpened = sum(opening.map((e) => e.qty));
  const qtyClosed = sum(closing.map((e) => e.qty));
  if (qtyClosed > qtyOpened + EPSILON) {
    issues.push({ field: "executions", message: CALC_ERRORS.qtyClosedExceeds });
  }
  const entryAvg = weightedAverage(opening);
  if (input.initialStop != null && entryAvg != null) {
    const wrongSide = input.direction === "long" ? input.initialStop >= entryAvg : input.initialStop <= entryAvg;
    if (wrongSide) issues.push({ field: "initialStop", message: CALC_ERRORS.stopWrongSide });
  }
  return issues;
}

export class TradeCalcError extends Error {
  readonly issues: CalcIssue[];

  constructor(issues: CalcIssue[]) {
    super(issues.map((i) => i.message).join(" "));
    this.name = "TradeCalcError";
    this.issues = issues;
  }
}

/** Classifies a net P&L against the break-even threshold. */
export function classifyResult(netPnl: number | null, status: "open" | "closed", beThreshold: number): TradeResult {
  if (status === "open" || netPnl == null) return "open";
  const threshold = Math.abs(beThreshold);
  if (netPnl > threshold) return "win";
  if (netPnl < -threshold) return "loss";
  return "be";
}

/**
 * Computes every derived trade column (section 6, items 1–9).
 * Throws a TradeCalcError when the input violates the validation rules.
 */
export function computeTrade(input: TradeCalcInput): TradeCalcResult {
  const issues = validateTradeCalc(input);
  if (issues.length > 0) throw new TradeCalcError(issues);

  const m = input.multiplier;
  const fx = input.fxRate;
  const opening = input.executions.filter((e) => isOpeningSide(input.direction, e.side));
  const closing = input.executions.filter((e) => !isOpeningSide(input.direction, e.side));

  const qtyOpened = sum(opening.map((e) => e.qty));
  const qtyClosed = sum(closing.map((e) => e.qty));
  const entryAvg = weightedAverage(opening);
  const exitAvg = weightedAverage(closing);

  const status: "open" | "closed" = qtyOpened > 0 && Math.abs(qtyClosed - qtyOpened) <= EPSILON ? "closed" : "open";
  const openedAt = opening.length > 0 ? Math.min(...opening.map((e) => e.executedAt)) : null;
  const closedAt = status === "closed" && closing.length > 0 ? Math.max(...closing.map((e) => e.executedAt)) : null;

  const totalFees = sum(input.executions.map((e) => e.fee)) + input.fees;

  let grossPnl: number | null = null;
  let netPnl: number | null = null;
  if (input.pnlMode === "manual") {
    if (input.manualNetPnl != null) {
      netPnl = input.manualNetPnl;
      grossPnl = input.manualNetPnl + totalFees - input.swap;
    }
  } else if (entryAvg != null && exitAvg != null && qtyClosed > 0) {
    const move = input.direction === "long" ? exitAvg - entryAvg : entryAvg - exitAvg;
    grossPnl = move * qtyClosed * m * fx;
    netPnl = grossPnl - totalFees + input.swap;
  }

  const initialRisk =
    input.initialStop != null && entryAvg != null ? Math.abs(entryAvg - input.initialStop) * qtyOpened * m * fx : null;

  const rMultiple =
    status === "closed" && netPnl != null && initialRisk != null && initialRisk > 0 ? netPnl / initialRisk : null;

  const holdMinutes =
    status === "closed" && openedAt != null && closedAt != null ? (closedAt - openedAt) / 60000 : null;

  return {
    qtyOpened,
    qtyClosed,
    entryAvg,
    exitAvg,
    status,
    openedAt,
    closedAt,
    grossPnl,
    netPnl,
    initialRisk,
    rMultiple,
    result: classifyResult(netPnl, status, input.beThreshold),
    holdMinutes,
    totalFees,
  };
}

/** Planned reward-to-risk ratio (form helper, not stored). */
export function plannedRiskReward(entry: number, stop: number, target: number): number | null {
  const risk = Math.abs(entry - stop);
  if (!Number.isFinite(risk) || risk === 0) return null;
  return Math.abs(target - entry) / risk;
}

/** Suggested position size, rounded down to 2 decimals (form helper). */
export function positionSize(params: {
  accountBalance: number;
  riskPercent: number;
  entry: number;
  stop: number;
  multiplier: number;
  fxRate: number;
}): number | null {
  const perUnitRisk = Math.abs(params.entry - params.stop) * params.multiplier * params.fxRate;
  if (!Number.isFinite(perUnitRisk) || perUnitRisk <= 0) return null;
  const riskAmount = (params.accountBalance * params.riskPercent) / 100;
  if (!Number.isFinite(riskAmount) || riskAmount <= 0) return null;
  const qty = riskAmount / perUnitRisk;
  return Math.floor(qty * 100 + EPSILON) / 100;
}

/** Money at risk for a planned trade (form helper). */
export function plannedRisk(params: {
  entry: number;
  stop: number;
  qty: number;
  multiplier: number;
  fxRate: number;
}): number | null {
  const value = Math.abs(params.entry - params.stop) * params.qty * params.multiplier * params.fxRate;
  return Number.isFinite(value) ? value : null;
}
