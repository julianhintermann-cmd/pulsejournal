/** Cookie helpers that are safe to use in the request proxy (no database access). */

export const SESSION_COOKIE = "pulse_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_RENEW_BELOW_MS = 15 * 24 * 60 * 60 * 1000;

/** Decides the `Secure` flag from COOKIE_SECURE and the forwarded protocol. */
export function shouldUseSecureCookie(forwardedProto: string | null, requestProtocol?: string) {
  const mode = (process.env.COOKIE_SECURE || "auto").toLowerCase();
  if (mode === "true") return true;
  if (mode === "false") return false;
  const proto = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  if (proto) return proto === "https";
  return requestProtocol === "https:";
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
    maxAge: SESSION_TTL_MS / 1000,
  };
}
