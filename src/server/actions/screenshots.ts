"use server";

import { revalidatePath } from "next/cache";

import { and, eq, inArray, isNull, max } from "drizzle-orm";

import { fail, GENERIC_ERROR, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { screenshots, trades, type Screenshot } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { deleteStoredFiles, storeImage, UploadError } from "@/lib/uploads";
import { dayKeySchema } from "@/lib/validation";

function revalidateOwner(row: Pick<Screenshot, "tradeId" | "journalDate">) {
  if (row.tradeId) {
    revalidatePath(`/trades/${row.tradeId}`);
    revalidatePath("/trades");
    revalidatePath("/playbooks", "layout");
  }
  if (row.journalDate) revalidatePath(`/journal/${row.journalDate}`);
}

/** Uploads one image (FormData: file, tradeId | journalDate, caption?) and stores it as WebP + thumbnail. */
export async function uploadScreenshot(formData: FormData): Promise<ActionResult<Screenshot>> {
  await requireUser();
  const file = formData.get("file");
  const tradeId = formData.get("tradeId");
  const journalDate = formData.get("journalDate");
  const caption = formData.get("caption");
  if (!(file instanceof File)) return fail("Keine Datei erhalten.");
  const target =
    typeof tradeId === "string" && tradeId
      ? { tradeId, journalDate: null }
      : typeof journalDate === "string" && dayKeySchema.safeParse(journalDate).success
        ? { tradeId: null, journalDate }
        : null;
  if (!target) return fail("Ungültiges Ziel für den Screenshot.");
  const db = getDb();
  if (target.tradeId && !db.select({ id: trades.id }).from(trades).where(eq(trades.id, target.tradeId)).get()) {
    return fail("Trade nicht gefunden.");
  }

  try {
    const stored = await storeImage(Buffer.from(await file.arrayBuffer()), file.type);
    const owner = target.tradeId
      ? eq(screenshots.tradeId, target.tradeId)
      : eq(screenshots.journalDate, target.journalDate!);
    const [{ value }] = db
      .select({ value: max(screenshots.position) })
      .from(screenshots)
      .where(owner)
      .all();
    const row = db
      .insert(screenshots)
      .values({
        ...target,
        ...stored,
        caption: typeof caption === "string" && caption.trim() ? caption.trim().slice(0, 300) : null,
        position: (value ?? -1) + 1,
      })
      .returning()
      .get();
    revalidateOwner(row);
    return ok(row);
  } catch (error) {
    if (error instanceof UploadError) return fail(error.message);
    log.error("uploadScreenshot failed", error);
    return fail(GENERIC_ERROR);
  }
}

export async function deleteScreenshot(id: string): Promise<ActionResult> {
  await requireUser();
  const db = getDb();
  const row = db.select().from(screenshots).where(eq(screenshots.id, id)).get();
  if (!row) return ok();
  db.delete(screenshots).where(eq(screenshots.id, id)).run();
  await deleteStoredFiles([row.filePath, row.thumbPath]);
  revalidateOwner(row);
  return ok();
}

/** Applies order, captions and deletions in one go (used by the trade form on save). */
export async function syncScreenshots(
  owner: { tradeId?: string; journalDate?: string },
  items: { id: string; caption: string | null }[],
): Promise<ActionResult> {
  await requireUser();
  const db = getDb();
  const where = owner.tradeId
    ? eq(screenshots.tradeId, owner.tradeId)
    : owner.journalDate
      ? and(eq(screenshots.journalDate, owner.journalDate), isNull(screenshots.tradeId))
      : null;
  if (!where) return fail("Ungültiges Ziel.");
  const existing = db.select().from(screenshots).where(where).all();
  const keep = new Set(items.map((i) => i.id));
  const removed = existing.filter((s) => !keep.has(s.id));
  db.transaction(() => {
    if (removed.length > 0)
      db.delete(screenshots)
        .where(
          inArray(
            screenshots.id,
            removed.map((r) => r.id),
          ),
        )
        .run();
    items.forEach((item, position) => {
      db.update(screenshots)
        .set({ position, caption: item.caption?.trim() ? item.caption.trim().slice(0, 300) : null })
        .where(and(eq(screenshots.id, item.id), where))
        .run();
    });
  });
  await deleteStoredFiles(removed.flatMap((r) => [r.filePath, r.thumbPath]));
  revalidateOwner({ tradeId: owner.tradeId ?? null, journalDate: owner.journalDate ?? null });
  return ok();
}

export async function updateScreenshotCaption(id: string, caption: string): Promise<ActionResult> {
  await requireUser();
  const db = getDb();
  const row = db.select().from(screenshots).where(eq(screenshots.id, id)).get();
  if (!row) return fail("Screenshot nicht gefunden.");
  db.update(screenshots)
    .set({ caption: caption.trim() ? caption.trim().slice(0, 300) : null })
    .where(eq(screenshots.id, id))
    .run();
  revalidateOwner(row);
  return ok();
}

export async function reorderScreenshots(ids: string[]): Promise<ActionResult> {
  await requireUser();
  const db = getDb();
  db.transaction(() => {
    ids.forEach((id, position) => db.update(screenshots).set({ position }).where(eq(screenshots.id, id)).run());
  });
  const first = ids[0] ? db.select().from(screenshots).where(eq(screenshots.id, ids[0])).get() : null;
  if (first) revalidateOwner(first);
  return ok();
}
