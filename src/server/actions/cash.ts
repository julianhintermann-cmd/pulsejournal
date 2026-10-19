"use server";

import { revalidatePath } from "next/cache";

import { eq } from "drizzle-orm";

import { fail, ok, VALIDATION_ERROR, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { cashTransactions } from "@/lib/db/schema";
import { cashTransactionSchema, fieldErrors } from "@/lib/validation";

export async function createCashTransaction(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = cashTransactionSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR, fieldErrors(parsed.error));
  getDb().insert(cashTransactions).values(parsed.data).run();
  revalidatePath("/", "layout");
  return ok();
}

export async function deleteCashTransaction(id: string): Promise<ActionResult> {
  await requireUser();
  getDb().delete(cashTransactions).where(eq(cashTransactions.id, id)).run();
  revalidatePath("/", "layout");
  return ok();
}
