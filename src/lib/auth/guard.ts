import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { count } from "drizzle-orm";

import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { validateSessionToken, type SessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export function hasUsers() {
  const [{ value }] = getDb().select({ value: count() }).from(users).all();
  return value > 0;
}

/** The authenticated user of the current request (memoised per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  return validateSessionToken(store.get(SESSION_COOKIE)?.value);
});

/** For pages and server actions: redirects to /setup or /login when there is no valid session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(hasUsers() ? "/login" : "/setup");
}

/** For route handlers: returns null instead of redirecting. */
export async function getApiUser(): Promise<SessionUser | null> {
  return getCurrentUser();
}

export function unauthorized() {
  return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
}
