"use server";

import { revalidatePath } from "next/cache";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { fail, GENERIC_ERROR, ok, VALIDATION_ERROR, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { csvMappings } from "@/lib/db/schema";
import { runCsvImport, type ImportSummary } from "@/lib/import/run";
import { log } from "@/lib/log";
import { getSettings } from "@/lib/settings";
import { TradeSaveError } from "@/lib/trades/save";
import { csvMappingSchema } from "@/lib/validation";

const importSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(15 * 1024 * 1024),
  fileName: z.string().max(200),
  mapping: csvMappingSchema,
  accountId: z.string().min(1),
  playbookId: z.string().nullable(),
  skipDuplicates: z.boolean(),
});

export async function importCsv(input: unknown): Promise<ActionResult<ImportSummary>> {
  await requireUser();
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR);
  try {
    const summary = runCsvImport({ ...parsed.data, timeZone: getSettings().displayTimezone });
    revalidatePath("/", "layout");
    return ok(summary);
  } catch (error) {
    if (error instanceof TradeSaveError) return fail(error.message);
    log.error("CSV import failed", error);
    return fail(GENERIC_ERROR);
  }
}

export async function saveCsvMapping(name: string, mapping: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsedName = z.string().trim().min(1).max(80).safeParse(name);
  const parsedMapping = csvMappingSchema.safeParse(mapping);
  if (!parsedName.success || !parsedMapping.success) return fail("Bitte einen Namen für die Zuordnung eingeben.");
  const row = getDb()
    .insert(csvMappings)
    .values({ name: parsedName.data, mappingJson: JSON.stringify(parsedMapping.data) })
    .returning({ id: csvMappings.id })
    .get();
  revalidatePath("/import-export");
  return ok({ id: row.id });
}

export async function deleteCsvMapping(id: string): Promise<ActionResult> {
  await requireUser();
  getDb().delete(csvMappings).where(eq(csvMappings.id, id)).run();
  revalidatePath("/import-export");
  return ok();
}
