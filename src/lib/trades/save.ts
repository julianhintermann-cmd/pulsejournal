import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";

import { TradeCalcError } from "@/lib/calc/trade";
import { getDb } from "@/lib/db/client";
import {
  accounts,
  executions,
  instruments,
  mistakes,
  playbookRules,
  screenshots,
  tags,
  tradeMistakes,
  tradeRuleChecks,
  trades,
  tradeTags,
} from "@/lib/db/schema";
import { recomputeTrade } from "@/lib/trades/recompute";
import { deleteStoredFiles } from "@/lib/uploads";
import { PALETTE, type TradeInput } from "@/lib/validation";

export class TradeSaveError extends Error {
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "TradeSaveError";
    this.fieldErrors = fieldErrors;
  }
}

/** Finds an instrument by symbol or creates it (asset class other, multiplier 1, account currency). */
export function ensureInstrument(symbol: string, currency: string) {
  const db = getDb();
  const normalized = symbol.trim().toUpperCase();
  const existing = db.select().from(instruments).where(eq(instruments.symbol, normalized)).get();
  if (existing) return { instrument: existing, created: false };
  const instrument = db
    .insert(instruments)
    .values({ symbol: normalized, assetClass: "other", multiplier: 1, quoteCurrency: currency })
    .returning()
    .get();
  return { instrument, created: true };
}

/** Upserts tags by name (case-insensitive) and returns their ids. */
export function ensureTags(names: string[]) {
  const db = getDb();
  const all = db.select().from(tags).all();
  const ids: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const found = all.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (found) {
      if (!ids.includes(found.id)) ids.push(found.id);
      continue;
    }
    const created = db
      .insert(tags)
      .values({ name, color: PALETTE[all.length % PALETTE.length] })
      .returning()
      .get();
    all.push(created);
    ids.push(created.id);
  }
  return ids;
}

/**
 * Creates (id = null) or updates a trade with its executions, tags, mistakes and rule checks, then recomputes
 * the derived columns. Runs in one transaction; throws TradeSaveError with field errors on invalid input.
 */
export function saveTrade(id: string | null, input: TradeInput) {
  const db = getDb();
  try {
    return db.transaction(() => {
      const account = db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();
      if (!account) throw new TradeSaveError("Konto nicht gefunden.", { accountId: "Konto nicht gefunden." });

      const { instrument, created } = ensureInstrument(input.symbol, account.currency);

      const opening = input.executions.filter((e) =>
        input.direction === "long" ? e.side === "buy" : e.side === "sell",
      );
      const openedAt = Math.min(...opening.map((e) => e.executedAt));
      const now = Date.now();

      const base = {
        accountId: input.accountId,
        instrumentId: instrument.id,
        playbookId: input.playbookId,
        direction: input.direction,
        openedAt,
        timeframe: input.timeframe,
        initialStop: input.initialStop,
        initialTarget: input.initialTarget,
        pnlMode: input.pnlMode,
        manualNetPnl: input.pnlMode === "manual" ? input.manualNetPnl : null,
        fxRate: input.fxRate,
        fees: input.fees,
        swap: input.swap,
        executionRating: input.executionRating,
        confidence: input.confidence,
        emotionBefore: input.emotionBefore,
        emotionAfter: input.emotionAfter,
        notes: input.notes,
        tradingviewUrl: input.tradingviewUrl,
        updatedAt: now,
      };

      let tradeId: string;
      if (id) {
        const result = db
          .update(trades)
          .set(base)
          .where(and(eq(trades.id, id)))
          .run();
        if (result.changes === 0) throw new TradeSaveError("Trade nicht gefunden.");
        tradeId = id;
        db.delete(executions).where(eq(executions.tradeId, id)).run();
        db.delete(tradeTags).where(eq(tradeTags.tradeId, id)).run();
        db.delete(tradeMistakes).where(eq(tradeMistakes.tradeId, id)).run();
        db.delete(tradeRuleChecks).where(eq(tradeRuleChecks.tradeId, id)).run();
      } else {
        tradeId = db
          .insert(trades)
          .values({ ...base, createdAt: now })
          .returning({ id: trades.id })
          .get().id;
      }

      db.insert(executions)
        .values(input.executions.map((e) => ({ ...e, tradeId })))
        .run();

      const tagIds = ensureTags(input.tagNames);
      if (tagIds.length > 0)
        db.insert(tradeTags)
          .values(tagIds.map((tagId) => ({ tradeId, tagId })))
          .run();

      if (input.mistakeIds.length > 0) {
        const valid = db.select({ id: mistakes.id }).from(mistakes).where(inArray(mistakes.id, input.mistakeIds)).all();
        if (valid.length > 0)
          db.insert(tradeMistakes)
            .values(valid.map((m) => ({ tradeId, mistakeId: m.id })))
            .run();
      }

      if (input.playbookId && input.ruleChecks.length > 0) {
        const rules = db
          .select({ id: playbookRules.id })
          .from(playbookRules)
          .where(eq(playbookRules.playbookId, input.playbookId))
          .all();
        const ruleIds = new Set(rules.map((r) => r.id));
        const checks = input.ruleChecks.filter((c) => ruleIds.has(c.ruleId));
        if (checks.length > 0) {
          db.insert(tradeRuleChecks)
            .values(checks.map((c) => ({ tradeId, ruleId: c.ruleId, checked: c.checked })))
            .run();
        }
      }

      recomputeTrade(tradeId);
      return { id: tradeId, newInstrument: created ? { id: instrument.id, symbol: instrument.symbol } : null };
    });
  } catch (error) {
    if (error instanceof TradeCalcError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) fieldErrors[issue.field] = issue.message;
      throw new TradeSaveError(error.issues[0]?.message ?? "Ungültige Eingabe.", fieldErrors);
    }
    throw error;
  }
}

/** Hard-deletes trades (and their screenshot files). */
export async function hardDeleteTrades(ids: string[]) {
  if (ids.length === 0) return;
  const db = getDb();
  const files = db
    .select({ filePath: screenshots.filePath, thumbPath: screenshots.thumbPath })
    .from(screenshots)
    .where(inArray(screenshots.tradeId, ids))
    .all();
  db.delete(trades).where(inArray(trades.id, ids)).run();
  await deleteStoredFiles(files.flatMap((f) => [f.filePath, f.thumbPath]));
}

export const UNDO_WINDOW_MS = 5_000;

/** Purges soft-deleted trades whose undo window has passed. */
export async function purgeDeletedTrades() {
  const db = getDb();
  const ids = db
    .select({ id: trades.id })
    .from(trades)
    .where(and(isNotNull(trades.deletedAt), lt(trades.deletedAt, Date.now() - UNDO_WINDOW_MS)))
    .all()
    .map((t) => t.id);
  await hardDeleteTrades(ids);
  return ids.length;
}
