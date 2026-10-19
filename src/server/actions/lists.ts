"use server";

import { revalidatePath } from "next/cache";

import { count, eq, max } from "drizzle-orm";

import { fail, GENERIC_ERROR, ok, VALIDATION_ERROR, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { emotions, instruments, mistakes, tags, trades } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { recomputeAllTrades } from "@/lib/trades/recompute";
import { fieldErrors, instrumentSchema, listNameSchema, PALETTE } from "@/lib/validation";

export type ListKind = "tags" | "mistakes" | "emotions";

const DUPLICATE = "Dieser Name existiert bereits.";

function isUniqueViolation(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

function revalidate() {
  revalidatePath("/", "layout");
}

function parseName(name: unknown) {
  return listNameSchema.safeParse(name);
}

export async function createListItem(kind: ListKind, name: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = parseName(name);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? VALIDATION_ERROR);
  const db = getDb();
  try {
    let id: string;
    if (kind === "tags") {
      const [{ value }] = db.select({ value: count() }).from(tags).all();
      id = db
        .insert(tags)
        .values({ name: parsed.data, color: PALETTE[value % PALETTE.length] })
        .returning({ id: tags.id })
        .get().id;
    } else {
      const table = kind === "mistakes" ? mistakes : emotions;
      const [{ value }] = db
        .select({ value: max(table.position) })
        .from(table)
        .all();
      id = db
        .insert(table)
        .values({ name: parsed.data, position: (value ?? -1) + 1 })
        .returning({ id: table.id })
        .get().id;
    }
    revalidate();
    return ok({ id });
  } catch (error) {
    if (isUniqueViolation(error)) return fail(DUPLICATE);
    log.error("createListItem failed", error);
    return fail(GENERIC_ERROR);
  }
}

export async function renameListItem(kind: ListKind, id: string, name: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = parseName(name);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? VALIDATION_ERROR);
  const db = getDb();
  try {
    db.transaction((tx) => {
      if (kind === "tags") {
        tx.update(tags).set({ name: parsed.data }).where(eq(tags.id, id)).run();
      } else if (kind === "mistakes") {
        tx.update(mistakes).set({ name: parsed.data }).where(eq(mistakes.id, id)).run();
      } else {
        const previous = tx.select().from(emotions).where(eq(emotions.id, id)).get();
        tx.update(emotions).set({ name: parsed.data }).where(eq(emotions.id, id)).run();
        // Trades store the emotion name, so keep them in sync.
        if (previous) {
          tx.update(trades).set({ emotionBefore: parsed.data }).where(eq(trades.emotionBefore, previous.name)).run();
          tx.update(trades).set({ emotionAfter: parsed.data }).where(eq(trades.emotionAfter, previous.name)).run();
        }
      }
    });
    revalidate();
    return ok();
  } catch (error) {
    if (isUniqueViolation(error)) return fail(DUPLICATE);
    log.error("renameListItem failed", error);
    return fail(GENERIC_ERROR);
  }
}

export async function deleteListItem(kind: ListKind, id: string): Promise<ActionResult> {
  await requireUser();
  const db = getDb();
  db.transaction((tx) => {
    if (kind === "tags") tx.delete(tags).where(eq(tags.id, id)).run();
    else if (kind === "mistakes") tx.delete(mistakes).where(eq(mistakes.id, id)).run();
    else {
      const previous = tx.select().from(emotions).where(eq(emotions.id, id)).get();
      tx.delete(emotions).where(eq(emotions.id, id)).run();
      if (previous) {
        tx.update(trades).set({ emotionBefore: null }).where(eq(trades.emotionBefore, previous.name)).run();
        tx.update(trades).set({ emotionAfter: null }).where(eq(trades.emotionAfter, previous.name)).run();
      }
    }
  });
  revalidate();
  return ok();
}

/** Persists a new order for mistakes or emotions (ids in display order). */
export async function reorderListItems(kind: "mistakes" | "emotions", ids: string[]): Promise<ActionResult> {
  await requireUser();
  const table = kind === "mistakes" ? mistakes : emotions;
  getDb().transaction((tx) => {
    ids.forEach((id, position) => tx.update(table).set({ position }).where(eq(table.id, id)).run());
  });
  revalidate();
  return ok();
}

export async function updateTagColor(id: string, color: string): Promise<ActionResult> {
  await requireUser();
  if (!(PALETTE as readonly string[]).includes(color)) return fail(VALIDATION_ERROR);
  getDb().update(tags).set({ color }).where(eq(tags.id, id)).run();
  revalidate();
  return ok();
}

// ---------- Instruments ----------

export async function saveInstrument(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = instrumentSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR, fieldErrors(parsed.error));
  const db = getDb();
  try {
    let instrumentId: string;
    if (id) {
      const previous = db.select().from(instruments).where(eq(instruments.id, id)).get();
      if (!previous) return fail("Instrument nicht gefunden.");
      db.update(instruments).set(parsed.data).where(eq(instruments.id, id)).run();
      instrumentId = id;
      if (previous.multiplier !== parsed.data.multiplier) recomputeAllTrades({ instrumentId: id });
    } else {
      instrumentId = db.insert(instruments).values(parsed.data).returning({ id: instruments.id }).get().id;
    }
    revalidate();
    return ok({ id: instrumentId });
  } catch (error) {
    if (isUniqueViolation(error))
      return fail("Dieses Symbol existiert bereits.", { symbol: "Dieses Symbol existiert bereits." });
    log.error("saveInstrument failed", error);
    return fail(GENERIC_ERROR);
  }
}

export async function deleteInstrument(id: string): Promise<ActionResult> {
  await requireUser();
  const db = getDb();
  const [{ value }] = db.select({ value: count() }).from(trades).where(eq(trades.instrumentId, id)).all();
  if (value > 0) return fail(`Das Instrument wird von ${value} Trades verwendet und kann nicht gelöscht werden.`);
  db.delete(instruments).where(eq(instruments.id, id)).run();
  revalidate();
  return ok();
}
