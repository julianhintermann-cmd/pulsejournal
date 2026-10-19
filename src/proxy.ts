import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, sessionCookieOptions, shouldUseSecureCookie } from "@/lib/auth/cookie";

const PUBLIC_PATHS = ["/login", "/setup", "/api/health", "/manifest.webmanifest", "/sw.js", "/offline.html"];
const PUBLIC_PREFIXES = ["/icons/", "/launch/", "/_next/"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Redirects requests without a session cookie to /login. The session itself is validated against the
 * database in every page, server action and route handler (requireUser); here the cookie expiry is only
 * slid forward so an active session never silently expires in the browser.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (isPublic(pathname)) return NextResponse.next();

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  // Only refresh on plain GET navigations so that logout (a POST) can clear the cookie reliably.
  if (request.method !== "GET") return response;
  const secure = shouldUseSecureCookie(request.headers.get("x-forwarded-proto"), request.nextUrl.protocol);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(secure));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|launch/|api/import/backup|favicon.ico).*)"],
};
