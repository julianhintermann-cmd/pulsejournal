"use server";

import { revalidatePath } from "next/cache";

import { eq, inArray } from "drizzle-orm";

import { fail, GENERIC_ERROR, ok, VALIDATION_ERROR, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { searchTrades as searchTradesQuery, type TradeSearchHit } from "@/lib/db/queries";
import { accounts, instruments, tradeMistakes, tradeRuleChecks, trades, tradeTags } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { recomputeTrade } from "@/lib/trades/recompute";
import {
  ensureInstrument as ensureInstrumentRow,
  ensureTags,
  hardDeleteTrades,
  purgeDeletedTrades,
  saveTrade,
  TradeSaveError,
  UNDO_WINDOW_MS,
} from "@/lib/trades/save";
import { bulkUpdateSchema, fieldErrors, tradeSchema } from "@/lib/validation";

function revalidateTrades() {
  for (const path of ["/", "/trades", "/calendar", "/stats", "/playbooks", "/journal"]) revalidatePath(path);
}

type SaveResult = ActionResult<{ id: string; newInstrument: { id: string; symbol: string } | null }>;

function handleSave(id: string | null, input: unknown): SaveResult {
  const parsed = tradeSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR, fieldErrors(parsed.error));
  try {
    const result = saveTrade(id, parsed.data);
    revalidateTrades();
    if (id) revalidatePath(`/trades/${id}`);
    return ok(result);
  } catch (error) {
    if (error instanceof TradeSaveError) return fail(error.message, error.fieldErrors);
    log.error("saveTrade failed", error);
    return fail(GENERIC_ERROR);
  }
}

export async function createTrade(input: unknown): Promise<SaveResult> {
  await requireUser();
  return handleSave(null, input);
}

export async function updateTrade(id: string, input: unknown): Promise<SaveResult> {
  await requireUser();
  return handleSave(id, input);
}

/** Soft delete; the trade is purged after the 5 s undo window unless restored. */
export async function deleteTrade(id: string): Promise<ActionResult> {
  await requireUser();
  getDb().update(trades).set({ deletedAt: Date.now() }).where(eq(trades.id, id)).run();
  setTimeout(() => {
    purgeDeletedTrades().catch((error) => log.error("purgeDeletedTrades failed", error));
  }, UNDO_WINDOW_MS + 500);
  revalidateTrades();
  return ok();
}

export async function restoreTrade(id: string): Promise<ActionResult> {
  await requireUser();
  const result = getDb().update(trades).set({ deletedAt: null }).where(eq(trades.id, id)).run();
  if (result.changes === 0) return fail("Der Trade wurde bereits endgültig gelöscht.");
  revalidateTrades();
  revalidatePath(`/trades/${id}`);
  return ok();
}

/** Copies a trade without executions and screenshots; the user completes it in the edit form. */
export async function duplicateTrade(id: string): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const db = getDb();
  const source = db.select().from(trades).where(eq(trades.id, id)).get();
  if (!source) return fail("Trade nicht gefunden.");
  try {
    const newId = db.transaction(() => {
      const now = Date.now();
      const copy = db
        .insert(trades)
        .values({
          accountId: source.accountId,
          instrumentId: source.instrumentId,
          playbookId: source.playbookId,
          direction: source.direction,
          openedAt: now,
          timeframe: source.timeframe,
          initialStop: source.initialStop,
          initialTarget: source.initialTarget,
          pnlMode: source.pnlMode,
          manualNetPnl: source.manualNetPnl,
          fxRate: source.fxRate,
          fees: source.fees,
          swap: source.swap,
          executionRating: source.executionRating,
          confidence: source.confidence,
          emotionBefore: source.emotionBefore,
          emotionAfter: source.emotionAfter,
          notes: source.notes,
          tradingviewUrl: source.tradingviewUrl,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: trades.id })
        .get().id;
      const tagRows = db.select().from(tradeTags).where(eq(tradeTags.tradeId, id)).all();
      if (tagRows.length)
        db.insert(tradeTags)
          .values(tagRows.map((r) => ({ ...r, tradeId: copy })))
          .run();
      const mistakeRows = db.select().from(tradeMistakes).where(eq(tradeMistakes.tradeId, id)).all();
      if (mistakeRows.length)
        db.insert(tradeMistakes)
          .values(mistakeRows.map((r) => ({ ...r, tradeId: copy })))
          .run();
      const ruleRows = db.select().from(tradeRuleChecks).where(eq(tradeRuleChecks.tradeId, id)).all();
      if (ruleRows.length)
        db.insert(tradeRuleChecks)
          .values(ruleRows.map((r) => ({ ...r, tradeId: copy })))
          .run();
      recomputeTrade(copy);
      return copy;
    });
    revalidateTrades();
    return ok({ id: newId });
  } catch (error) {
    log.error("duplicateTrade failed", error);
    return fail(GENERIC_ERROR);
  }
}

export async function bulkUpdateTrades(input: unknown): Promise<ActionResult<{ count: number }>> {
  await requireUser();
  const parsed = bulkUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR);
  const { ids, addTagNames, playbookId } = parsed.data;
  const db = getDb();
  db.transaction(() => {
    if (addTagNames && addTagNames.length > 0) {
      const tagIds = ensureTags(addTagNames);
      for (const tradeId of ids) {
        db.insert(tradeTags)
          .values(tagIds.map((tagId) => ({ tradeId, tagId })))
          .onConflictDoNothing()
          .run();
      }
    }
    if (playbookId !== undefined) {
      db.update(trades).set({ playbookId, updatedAt: Date.now() }).where(inArray(trades.id, ids)).run();
      // Rule checks belong to the previous playbook and no longer apply.
      db.delete(tradeRuleChecks).where(inArray(tradeRuleChecks.tradeId, ids)).run();
    }
  });
  revalidateTrades();
  return ok({ count: ids.length });
}

export async function deleteTrades(ids: string[]): Promise<ActionResult<{ count: number }>> {
  await requireUser();
  if (!Array.isArray(ids) || ids.length === 0) return fail(VALIDATION_ERROR);
  try {
    await hardDeleteTrades(ids.map(String));
  } catch (error) {
    log.error("deleteTrades failed", error);
    return fail(GENERIC_ERROR);
  }
  revalidateTrades();
  return ok({ count: ids.length });
}

/** Called when a new symbol is entered in the trade form: creates the instrument right away. */
export async function ensureInstrument(
  symbol: string,
  accountId: string,
): Promise<ActionResult<{ id: string; symbol: string; multiplier: number; quoteCurrency: string; created: boolean }>> {
  await requireUser();
  const normalized = String(symbol).trim().toUpperCase();
  if (!/^[A-Z0-9._/!:-]{1,30}$/.test(normalized)) return fail("Ungültiges Symbol.");
  const db = getDb();
  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  const existing = db.select().from(instruments).where(eq(instruments.symbol, normalized)).get();
  const { instrument, created } = existing
    ? { instrument: existing, created: false }
    : ensureInstrumentRow(normalized, account?.currency ?? "CHF");
  if (created) revalidatePath("/settings");
  return ok({
    id: instrument.id,
    symbol: instrument.symbol,
    multiplier: instrument.multiplier,
    quoteCurrency: instrument.quoteCurrency,
    created,
  });
}

export async function searchTrades(query: string): Promise<TradeSearchHit[]> {
  await requireUser();
  return searchTradesQuery(String(query).slice(0, 100));
}
