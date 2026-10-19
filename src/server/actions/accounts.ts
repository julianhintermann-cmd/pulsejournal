"use server";

import { revalidatePath } from "next/cache";

import { eq, inArray } from "drizzle-orm";

import { fail, GENERIC_ERROR, ok, VALIDATION_ERROR, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { accounts, screenshots, settings, trades } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { deleteStoredFiles } from "@/lib/uploads";
import { accountSchema, fieldErrors } from "@/lib/validation";

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createAccount(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR, fieldErrors(parsed.error));
  const row = getDb().insert(accounts).values(parsed.data).returning({ id: accounts.id }).get();
  revalidateAll();
  return ok({ id: row.id });
}

export async function updateAccount(id: string, input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR, fieldErrors(parsed.error));
  const result = getDb().update(accounts).set(parsed.data).where(eq(accounts.id, id)).run();
  if (result.changes === 0) return fail("Konto nicht gefunden.");
  revalidateAll();
  return ok();
}

export async function setAccountArchived(id: string, archived: boolean): Promise<ActionResult> {
  await requireUser();
  getDb().update(accounts).set({ archived }).where(eq(accounts.id, id)).run();
  revalidateAll();
  return ok();
}

/** Deletes an account with all its trades, cash transactions and screenshot files (cascade). */
export async function deleteAccount(id: string): Promise<ActionResult> {
  await requireUser();
  const db = getDb();
  try {
    const tradeIds = db
      .select({ id: trades.id })
      .from(trades)
      .where(eq(trades.accountId, id))
      .all()
      .map((t) => t.id);
    const files =
      tradeIds.length > 0
        ? db
            .select({ filePath: screenshots.filePath, thumbPath: screenshots.thumbPath })
            .from(screenshots)
            .where(inArray(screenshots.tradeId, tradeIds))
            .all()
        : [];
    db.transaction((tx) => {
      tx.delete(accounts).where(eq(accounts.id, id)).run();
      tx.update(settings).set({ defaultAccountId: null }).where(eq(settings.defaultAccountId, id)).run();
    });
    // Screenshot rows cascade with their trades; only the files need explicit removal.
    await deleteStoredFiles(files.flatMap((f) => [f.filePath, f.thumbPath]));
  } catch (error) {
    log.error("deleteAccount failed", error);
    return fail(GENERIC_ERROR);
  }
  revalidateAll();
  return ok();
}
