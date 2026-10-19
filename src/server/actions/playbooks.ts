"use server";

import { revalidatePath } from "next/cache";

import { and, eq, inArray, notInArray } from "drizzle-orm";

import { fail, ok, VALIDATION_ERROR, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { playbookRules, playbooks } from "@/lib/db/schema";
import { fieldErrors, playbookSchema } from "@/lib/validation";

function revalidate() {
  revalidatePath("/", "layout");
}

export async function savePlaybook(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = playbookSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR, fieldErrors(parsed.error));
  const { rules, ...values } = parsed.data;
  const db = getDb();
  const playbookId = db.transaction(() => {
    let pid: string;
    if (id) {
      db.update(playbooks).set(values).where(eq(playbooks.id, id)).run();
      pid = id;
    } else {
      pid = db.insert(playbooks).values(values).returning({ id: playbooks.id }).get().id;
    }
    // Keep existing rule ids so trade checklists stay attached; drop removed rules.
    const keep = rules.map((r) => r.id).filter((x): x is string => !!x);
    if (keep.length > 0) {
      db.delete(playbookRules)
        .where(and(eq(playbookRules.playbookId, pid), notInArray(playbookRules.id, keep)))
        .run();
    } else {
      db.delete(playbookRules).where(eq(playbookRules.playbookId, pid)).run();
    }
    const existing = new Set(
      keep.length > 0
        ? db
            .select({ id: playbookRules.id })
            .from(playbookRules)
            .where(inArray(playbookRules.id, keep))
            .all()
            .map((r) => r.id)
        : [],
    );
    rules.forEach((rule, position) => {
      if (rule.id && existing.has(rule.id)) {
        db.update(playbookRules).set({ text: rule.text, position }).where(eq(playbookRules.id, rule.id)).run();
      } else {
        db.insert(playbookRules).values({ playbookId: pid, text: rule.text, position }).run();
      }
    });
    return pid;
  });
  revalidate();
  return ok({ id: playbookId });
}

export async function setPlaybookArchived(id: string, archived: boolean): Promise<ActionResult> {
  await requireUser();
  getDb().update(playbooks).set({ archived }).where(eq(playbooks.id, id)).run();
  revalidate();
  return ok();
}

/** Deletes a playbook; its trades keep existing without a setup. */
export async function deletePlaybook(id: string): Promise<ActionResult> {
  await requireUser();
  getDb().delete(playbooks).where(eq(playbooks.id, id)).run();
  revalidate();
  return ok();
}
