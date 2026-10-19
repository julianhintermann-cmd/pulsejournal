import { closingSide, isOpeningSide, openingSide, type ExecutionInput } from "@/lib/calc/trade";
import { utcToZonedInput, zonedInputToUtc } from "@/lib/dates";
import type { Direction } from "@/lib/db/schema";
import { toNumber, type ExecutionFormValues, type TradeFormValues } from "@/lib/validation";

/** Executions represented by the form in its current mode (invalid rows are skipped). */
export function formExecutions(values: TradeFormValues, timeZone: string): ExecutionInput[] {
  if (values.mode === "quick") {
    const qty = toNumber(values.qty);
    const entry = toNumber(values.entryPrice);
    const entryAt = zonedInputToUtc(values.entryAt, timeZone);
    const out: ExecutionInput[] = [];
    const fees = values.executions.map((e) => toNumber(e.fee) ?? 0);
    if (qty && entry && entryAt != null) {
      out.push({ side: openingSide(values.direction), qty, price: entry, fee: fees[0] ?? 0, executedAt: entryAt });
      const exit = toNumber(values.exitPrice);
      const exitAt = zonedInputToUtc(values.exitAt, timeZone);
      if (exit && exitAt != null) {
        out.push({ side: closingSide(values.direction), qty, price: exit, fee: fees[1] ?? 0, executedAt: exitAt });
      }
    }
    return out;
  }
  return values.executions.flatMap((e) => {
    const qty = toNumber(e.qty);
    const price = toNumber(e.price);
    const executedAt = zonedInputToUtc(e.executedAt, timeZone);
    if (!qty || qty <= 0 || !price || price <= 0 || executedAt == null) return [];
    return [{ side: e.side, qty, price, fee: toNumber(e.fee) ?? 0, executedAt }];
  });
}

/** Converts validated form values into the server action payload (tradeSchema). */
export function buildTradePayload(values: TradeFormValues, timeZone: string) {
  return {
    accountId: values.accountId,
    symbol: values.symbol.trim().toUpperCase(),
    direction: values.direction,
    playbookId: values.playbookId || null,
    timeframe: values.timeframe || null,
    executions: formExecutions(values, timeZone),
    initialStop: toNumber(values.initialStop),
    initialTarget: toNumber(values.initialTarget),
    pnlMode: values.pnlMode,
    manualNetPnl: values.pnlMode === "manual" ? toNumber(values.manualNetPnl) : null,
    fxRate: toNumber(values.fxRate) ?? 1,
    fees: toNumber(values.fees) ?? 0,
    swap: toNumber(values.swap) ?? 0,
    executionRating: values.executionRating,
    confidence: values.confidence,
    emotionBefore: values.emotionBefore,
    emotionAfter: values.emotionAfter,
    mistakeIds: values.mistakeIds,
    tagNames: values.tagNames,
    ruleChecks: Object.entries(values.ruleChecks).map(([ruleId, checked]) => ({ ruleId, checked })),
    notes: values.notes,
    tradingviewUrl: values.tradingviewUrl.trim() || null,
  };
}

/** True when the executions can be shown in quick mode (one entry, at most one full exit). */
export function isQuickCompatible(executions: ExecutionFormValues[], direction: Direction) {
  const opening = executions.filter((e) => isOpeningSide(direction, e.side));
  const closing = executions.filter((e) => !isOpeningSide(direction, e.side));
  if (opening.length > 1 || closing.length > 1) return false;
  if (closing.length === 1 && opening.length === 1) {
    return toNumber(closing[0].qty) === toNumber(opening[0].qty);
  }
  return closing.length === 0;
}

/** Quick fields derived from detailed executions (call only when quick-compatible). */
export function quickFieldsFrom(executions: ExecutionFormValues[], direction: Direction) {
  const opening = executions.find((e) => isOpeningSide(direction, e.side));
  const closing = executions.find((e) => !isOpeningSide(direction, e.side));
  return {
    entryPrice: opening?.price ?? "",
    entryAt: opening?.executedAt ?? "",
    qty: opening?.qty ?? "",
    exitPrice: closing?.price ?? "",
    exitAt: closing?.executedAt ?? "",
  };
}

/** Detailed executions derived from the quick fields, keeping existing fees. */
export function executionsFromQuick(values: TradeFormValues, timeZone: string): ExecutionFormValues[] {
  const nowInput = utcToZonedInput(Date.now(), timeZone);
  const fees = values.executions.map((e) => e.fee);
  const rows: ExecutionFormValues[] = [
    {
      side: openingSide(values.direction),
      qty: values.qty,
      price: values.entryPrice,
      fee: fees[0] ?? "",
      executedAt: values.entryAt || nowInput,
    },
  ];
  if (values.exitPrice.trim()) {
    rows.push({
      side: closingSide(values.direction),
      qty: values.qty,
      price: values.exitPrice,
      fee: fees[1] ?? "",
      executedAt: values.exitAt || nowInput,
    });
  }
  return rows;
}

/** Labels each execution: "Einstieg", "Teil-Ausstieg" or "Ausstieg" (the one that closes the position). */
export function executionLabels(rows: { side: "buy" | "sell"; qty: string }[], direction: Direction) {
  const opened = rows.filter((r) => isOpeningSide(direction, r.side)).reduce((a, r) => a + (toNumber(r.qty) ?? 0), 0);
  let closed = 0;
  return rows.map((r) => {
    if (isOpeningSide(direction, r.side)) return "Einstieg";
    closed += toNumber(r.qty) ?? 0;
    return opened > 0 && Math.abs(closed - opened) < 1e-9 ? "Ausstieg" : "Teil-Ausstieg";
  });
}
