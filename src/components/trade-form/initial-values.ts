import { isOpeningSide, openingSide } from "@/lib/calc/trade";
import { utcToZonedInput } from "@/lib/dates";
import type { TradeDetail } from "@/lib/db/queries";
import type { TradeFormValues } from "@/lib/validation";

import { isQuickCompatible, quickFieldsFrom } from "./payload";

function str(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

export function newTradeValues(opts: {
  accountId: string;
  mode: "quick" | "detailed";
  timeZone: string;
  now?: number;
}): TradeFormValues {
  const nowInput = utcToZonedInput(opts.now ?? Date.now(), opts.timeZone);
  return {
    mode: opts.mode,
    accountId: opts.accountId,
    symbol: "",
    direction: "long",
    playbookId: "",
    timeframe: "",
    entryPrice: "",
    entryAt: nowInput,
    exitPrice: "",
    exitAt: nowInput,
    qty: "",
    executions: [{ side: "buy", qty: "", price: "", fee: "", executedAt: nowInput }],
    initialStop: "",
    initialTarget: "",
    pnlMode: "auto",
    manualNetPnl: "",
    fxRate: "1",
    fees: "",
    swap: "",
    executionRating: null,
    confidence: null,
    emotionBefore: null,
    emotionAfter: null,
    mistakeIds: [],
    tagNames: [],
    ruleChecks: {},
    notes: "",
    tradingviewUrl: "",
  };
}

export function tradeToValues(
  detail: TradeDetail,
  opts: { mode: "quick" | "detailed"; timeZone: string; now?: number },
): TradeFormValues {
  const { trade } = detail;
  const nowInput = utcToZonedInput(opts.now ?? Date.now(), opts.timeZone);
  const executions =
    detail.executions.length > 0
      ? detail.executions.map((e) => ({
          side: e.side,
          qty: String(e.qty),
          price: String(e.price),
          fee: e.fee ? String(e.fee) : "",
          executedAt: utcToZonedInput(e.executedAt, opts.timeZone),
        }))
      : [{ side: openingSide(trade.direction), qty: "", price: "", fee: "", executedAt: nowInput }];
  const quickOk = isQuickCompatible(executions, trade.direction);
  const quick = quickOk ? quickFieldsFrom(executions, trade.direction) : null;
  const hasClosing = executions.some((e) => !isOpeningSide(trade.direction, e.side));
  return {
    mode: quickOk ? opts.mode : "detailed",
    accountId: trade.accountId,
    symbol: detail.instrument.symbol,
    direction: trade.direction,
    playbookId: trade.playbookId ?? "",
    timeframe: trade.timeframe ?? "",
    entryPrice: quick?.entryPrice ?? "",
    entryAt: quick?.entryAt || nowInput,
    exitPrice: quick?.exitPrice ?? "",
    exitAt: (hasClosing ? quick?.exitAt : "") || nowInput,
    qty: quick?.qty ?? "",
    executions,
    initialStop: str(trade.initialStop),
    initialTarget: str(trade.initialTarget),
    pnlMode: trade.pnlMode,
    manualNetPnl: str(trade.manualNetPnl),
    fxRate: String(trade.fxRate),
    fees: trade.fees ? String(trade.fees) : "",
    swap: trade.swap ? String(trade.swap) : "",
    executionRating: trade.executionRating,
    confidence: trade.confidence,
    emotionBefore: trade.emotionBefore,
    emotionAfter: trade.emotionAfter,
    mistakeIds: detail.mistakes.map((m) => m.id),
    tagNames: detail.tags.map((t) => t.name),
    ruleChecks: Object.fromEntries(detail.rules.map((r) => [r.id, r.checked])),
    notes: trade.notes ?? "",
    tradingviewUrl: trade.tradingviewUrl ?? "",
  };
}
