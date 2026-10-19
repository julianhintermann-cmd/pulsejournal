import type { TradeRow } from "@/lib/db/queries";

/** Trade list filters (section 8.3) on top of the global filter; serialised into the URL. */
export type TradeListFilters = {
  symbols: string[];
  setups: string[];
  tags: string[];
  results: string[];
  direction: "long" | "short" | null;
  sessions: string[];
  mistakes: string[];
  q: string;
};

export const EMPTY_TRADE_FILTERS: TradeListFilters = {
  symbols: [],
  setups: [],
  tags: [],
  results: [],
  direction: null,
  sessions: [],
  mistakes: [],
  q: "",
};

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function get(params: Params, key: string) {
  if (params instanceof URLSearchParams) return params.get(key);
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function list(params: Params, key: string) {
  const raw = get(params, key);
  return raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

export function parseTradeFilters(params: Params): TradeListFilters {
  const direction = get(params, "direction");
  return {
    symbols: list(params, "symbols"),
    setups: list(params, "setups"),
    tags: list(params, "tags"),
    results: list(params, "results").filter((r) => ["win", "loss", "be", "open"].includes(r)),
    direction: direction === "long" || direction === "short" ? direction : null,
    sessions: list(params, "sessions").filter((s) => ["asia", "london", "newyork", "off"].includes(s)),
    mistakes: list(params, "mistakes"),
    q: (get(params, "q") ?? "").slice(0, 100),
  };
}

export function writeTradeFilters(params: URLSearchParams, filters: TradeListFilters) {
  const set = (key: string, values: string[]) =>
    values.length ? params.set(key, values.join(",")) : params.delete(key);
  set("symbols", filters.symbols);
  set("setups", filters.setups);
  set("tags", filters.tags);
  set("results", filters.results);
  set("sessions", filters.sessions);
  set("mistakes", filters.mistakes);
  if (filters.direction) params.set("direction", filters.direction);
  else params.delete("direction");
  if (filters.q.trim()) params.set("q", filters.q.trim());
  else params.delete("q");
  return params;
}

export function countActiveFilters(f: TradeListFilters) {
  return (
    f.symbols.length +
    f.setups.length +
    f.tags.length +
    f.results.length +
    f.sessions.length +
    f.mistakes.length +
    (f.direction ? 1 : 0) +
    (f.q.trim() ? 1 : 0)
  );
}

export function applyTradeFilters(rows: TradeRow[], f: TradeListFilters) {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.symbols.length && !f.symbols.includes(r.symbol)) return false;
    if (f.setups.length && !(r.playbook ? f.setups.includes(r.playbook.id) : f.setups.includes("none"))) return false;
    if (f.tags.length && !r.tags.some((t) => f.tags.includes(t.id))) return false;
    if (f.results.length && !f.results.includes(r.result)) return false;
    if (f.direction && r.direction !== f.direction) return false;
    if (f.sessions.length && !f.sessions.includes(r.session)) return false;
    if (f.mistakes.length && !r.mistakeIds.some((m) => f.mistakes.includes(m))) return false;
    if (q && !r.symbol.toLowerCase().includes(q) && !(r.notes ?? "").toLowerCase().includes(q)) return false;
    return true;
  });
}
