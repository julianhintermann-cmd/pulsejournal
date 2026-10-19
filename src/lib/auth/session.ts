import { createHmac, randomBytes } from "node:crypto";

import { and, eq, gt, lt, ne } from "drizzle-orm";

import { SESSION_RENEW_BELOW_MS, SESSION_TTL_MS } from "@/lib/auth/cookie";
import { getSessionSecret } from "@/lib/auth/secret";
import { getDb } from "@/lib/db/client";
import { sessions, users, type User } from "@/lib/db/schema";

/** Session ids are stored as HMAC-SHA256(secret, token); the raw token only lives in the cookie. */
export function hashToken(token: string) {
  return createHmac("sha256", getSessionSecret()).update(token).digest("hex");
}

export function createSession(userId: string, userAgent: string | null) {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  getDb()
    .insert(sessions)
    .values({
      id: hashToken(token),
      userId,
      expiresAt: now + SESSION_TTL_MS,
      createdAt: now,
      userAgent: userAgent?.slice(0, 300) ?? null,
    })
    .run();
  // Opportunistic cleanup of expired sessions.
  getDb().delete(sessions).where(lt(sessions.expiresAt, now)).run();
  return token;
}

export type SessionUser = Pick<User, "id" | "username"> & { sessionId: string };

/** Validates a cookie token and slides the expiry when fewer than 15 days remain. */
export function validateSessionToken(token: string | undefined | null): SessionUser | null {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const db = getDb();
  const id = hashToken(token);
  const row = db
    .select({ sessionId: sessions.id, expiresAt: sessions.expiresAt, id: users.id, username: users.username })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .get();
  if (!row) return null;
  const now = Date.now();
  if (row.expiresAt <= now) {
    db.delete(sessions).where(eq(sessions.id, id)).run();
    return null;
  }
  if (row.expiresAt - now < SESSION_RENEW_BELOW_MS) {
    db.update(sessions)
      .set({ expiresAt: now + SESSION_TTL_MS })
      .where(eq(sessions.id, id))
      .run();
  }
  return { id: row.id, username: row.username, sessionId: row.sessionId };
}

export function deleteSessionByToken(token: string) {
  getDb()
    .delete(sessions)
    .where(eq(sessions.id, hashToken(token)))
    .run();
}

export function deleteOtherSessions(userId: string, keepSessionId: string) {
  return getDb()
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)))
    .run().changes;
}

export function deleteAllSessions() {
  getDb().delete(sessions).run();
}

export function countOtherSessions(userId: string, keepSessionId: string) {
  return getDb()
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId), gt(sessions.expiresAt, Date.now())))
    .all().length;
}
