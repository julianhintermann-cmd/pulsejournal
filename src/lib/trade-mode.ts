import { cookies, headers } from "next/headers";

const COOKIE = "pulse_trade_mode";

/** Quick vs detailed: explicit ?mode=, else the last used mode (cookie), else quick on phones. */
export async function resolveTradeMode(param: string | undefined): Promise<"quick" | "detailed"> {
  if (param === "quick" || param === "detailed") return param;
  const stored = (await cookies()).get(COOKIE)?.value;
  if (stored === "quick" || stored === "detailed") return stored;
  const ua = (await headers()).get("user-agent") ?? "";
  return /Mobi|Android|iPhone|iPod/i.test(ua) ? "quick" : "detailed";
}
