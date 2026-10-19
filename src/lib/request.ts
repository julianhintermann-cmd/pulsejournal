import { headers } from "next/headers";

import { shouldUseSecureCookie } from "@/lib/auth/cookie";

export async function requestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || "local";
  return {
    ip,
    userAgent: h.get("user-agent"),
    secure: shouldUseSecureCookie(h.get("x-forwarded-proto")),
  };
}
