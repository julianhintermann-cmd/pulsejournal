import { cookies } from "next/headers";

import { FILTER_COOKIE, parseFilter, resolveFilter, type ResolvedFilter } from "@/lib/filter";
import { getSettings } from "@/lib/settings";

export type SearchParams = Record<string, string | string[] | undefined>;

/** Global filter for the current request: URL query first, then the persisted cookie, then defaults. */
export async function getFilter(searchParams: SearchParams): Promise<ResolvedFilter> {
  const store = await cookies();
  const persisted = store.get(FILTER_COOKIE)?.value ?? null;
  const settings = getSettings();
  const state = parseFilter(searchParams, persisted ? decodeURIComponent(persisted) : null);
  return resolveFilter(state, { timeZone: settings.displayTimezone, weekStartsOn: settings.weekStartsOn });
}

export async function getPersistedFilter() {
  const store = await cookies();
  const raw = store.get(FILTER_COOKIE)?.value;
  return raw ? decodeURIComponent(raw) : null;
}
