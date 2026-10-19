"use server";

import { requireUser } from "@/lib/auth/guard";
import { searchTrades as searchTradesQuery, type TradeSearchHit } from "@/lib/db/queries";

export async function searchTrades(query: string): Promise<TradeSearchHit[]> {
  await requireUser();
  return searchTradesQuery(String(query).slice(0, 100));
}
