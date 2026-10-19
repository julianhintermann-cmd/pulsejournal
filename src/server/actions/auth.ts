"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { eq } from "drizzle-orm";

import { fail, ok, VALIDATION_ERROR, type ActionResult } from "@/lib/action-result";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { hasUsers, requireUser } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { clearFailures, isRateLimited, recordFailure } from "@/lib/auth/rate-limit";
import { createSession, deleteOtherSessions, deleteSessionByToken } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { accounts, settings, users } from "@/lib/db/schema";
import { requestMeta } from "@/lib/request";
import { changePasswordSchema, fieldErrors, loginSchema, PALETTE, setupSchema } from "@/lib/validation";

const LOGIN_FAILED = "Benutzername oder Passwort falsch.";
const RATE_LIMITED = "Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.";

async function startSession(userId: string) {
  const meta = await requestMeta();
  const token = createSession(userId, meta.userAgent);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(meta.secure));
}

function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/";
}

export async function login(input: unknown, next?: string | null): Promise<ActionResult> {
  const meta = await requestMeta();
  if (isRateLimited(meta.ip)) return fail(RATE_LIMITED);
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR, fieldErrors(parsed.error));

  const user = getDb().select().from(users).where(eq(users.username, parsed.data.username)).get();
  const valid = user ? await verifyPassword(user.passwordHash, parsed.data.password) : false;
  if (!user || !valid) {
    recordFailure(meta.ip);
    return fail(isRateLimited(meta.ip) ? RATE_LIMITED : LOGIN_FAILED);
  }
  clearFailures(meta.ip);
  await startSession(user.id);
  redirect(safeNext(next));
}

export async function setup(input: unknown): Promise<ActionResult> {
  if (hasUsers()) return fail("Die Einrichtung ist bereits abgeschlossen.");
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR, fieldErrors(parsed.error));
  const data = parsed.data;
  const passwordHash = await hashPassword(data.password);

  const db = getDb();
  const userId = db.transaction((tx) => {
    const user = tx.insert(users).values({ username: data.username, passwordHash }).returning({ id: users.id }).get();
    const account = tx
      .insert(accounts)
      .values({
        name: data.account.name,
        type: data.account.type,
        currency: data.account.currency,
        startingBalance: data.account.startingBalance,
        color: PALETTE[0],
      })
      .returning({ id: accounts.id })
      .get();
    tx.insert(settings).values({ id: 1 }).onConflictDoNothing().run();
    tx.update(settings)
      .set({ baseCurrency: data.baseCurrency, displayTimezone: data.timezone, defaultAccountId: account.id })
      .where(eq(settings.id, 1))
      .run();
    return user.id;
  });

  await startSession(userId);
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) deleteSessionByToken(token);
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePassword(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR, fieldErrors(parsed.error));
  const db = getDb();
  const row = db.select().from(users).where(eq(users.id, user.id)).get();
  if (!row || !(await verifyPassword(row.passwordHash, parsed.data.currentPassword))) {
    return fail("Aktuelles Passwort ist falsch.", { currentPassword: "Aktuelles Passwort ist falsch." });
  }
  const passwordHash = await hashPassword(parsed.data.newPassword);
  db.update(users).set({ passwordHash }).where(eq(users.id, user.id)).run();
  return ok();
}

export async function revokeOtherSessions(): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  const removed = deleteOtherSessions(user.id, user.sessionId);
  return ok({ count: removed });
}
