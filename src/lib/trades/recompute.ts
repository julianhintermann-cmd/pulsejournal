import { asc, eq } from "drizzle-orm";

import { computeTrade } from "@/lib/calc/trade";
import { getDb } from "@/lib/db/client";
import { executions, instruments, trades } from "@/lib/db/schema";
import { classifySession } from "@/lib/sessions";
import { readSettings } from "@/lib/settings";

/**
 * Recomputes and stores every derived column of a trade from its executions (section 5.9).
 * Must be called after any change to a trade, its executions or its instrument. Throws TradeCalcError on
 * invalid input, which aborts the surrounding transaction.
 */
export function recomputeTrade(tradeId: string) {
  const db = getDb();
  const trade = db.select().from(trades).where(eq(trades.id, tradeId)).get();
  if (!trade) return null;
  const instrument = db.select().from(instruments).where(eq(instruments.id, trade.instrumentId)).get();
  const rows = db
    .select()
    .from(executions)
    .where(eq(executions.tradeId, tradeId))
    .orderBy(asc(executions.executedAt))
    .all();
  const settings = readSettings();

  const calc = computeTrade({
    direction: trade.direction,
    executions: rows.map((e) => ({ side: e.side, qty: e.qty, price: e.price, fee: e.fee, executedAt: e.executedAt })),
    multiplier: instrument?.multiplier ?? 1,
    fxRate: trade.fxRate,
    fees: trade.fees,
    swap: trade.swap,
    pnlMode: trade.pnlMode,
    manualNetPnl: trade.manualNetPnl,
    initialStop: trade.initialStop,
    beThreshold: settings.beThreshold,
  });

  const openedAt = calc.openedAt ?? trade.openedAt;
  const values = {
    status: calc.status,
    openedAt,
    closedAt: calc.closedAt,
    session: classifySession(openedAt, settings.displayTimezone, settings.sessions),
    entryAvg: calc.entryAvg,
    exitAvg: calc.exitAvg,
    qtyOpened: calc.qtyOpened,
    qtyClosed: calc.qtyClosed,
    grossPnl: calc.grossPnl,
    netPnl: calc.netPnl,
    initialRisk: calc.initialRisk,
    rMultiple: calc.rMultiple,
    result: calc.result,
    holdMinutes: calc.holdMinutes,
  };
  db.update(trades).set(values).where(eq(trades.id, tradeId)).run();
  return values;
}

/** Recomputes all trades (e.g. after the break-even threshold or session windows changed). */
export function recomputeAllTrades(filter?: { instrumentId?: string }) {
  const db = getDb();
  const ids = db
    .select({ id: trades.id })
    .from(trades)
    .where(filter?.instrumentId ? eq(trades.instrumentId, filter.instrumentId) : undefined)
    .all();
  db.transaction(() => {
    for (const { id } of ids) {
      try {
        recomputeTrade(id);
      } catch {
        // A trade that no longer validates keeps its previous derived values.
      }
    }
  });
  return ids.length;
}
