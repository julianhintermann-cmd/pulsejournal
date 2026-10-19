import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns";

export const RANGE_KEYS = ["today", "week", "month", "30d", "quarter", "year", "all", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Heute",
  week: "Diese Woche",
  month: "Dieser Monat",
  "30d": "Letzte 30 Tage",
  quarter: "Dieses Quartal",
  year: "Dieses Jahr",
  all: "Alles",
  custom: "Benutzerdefiniert",
};

export const DEFAULT_RANGE: RangeKey = "month";
export const FILTER_COOKIE = "pulse_filter";
export const FILTER_STORAGE_KEY = "pulse.filter";

export type FilterState = {
  range: RangeKey;
  accountId: string | null;
  /** Custom range bounds as `YYYY-MM-DD` (inclusive), only used when range = custom. */
  from: string | null;
  to: string | null;
};

export type ResolvedFilter = FilterState & {
  /** Inclusive start / exclusive end in UTC ms; null means unbounded. */
  start: number | null;
  end: number | null;
  prevStart: number | null;
  prevEnd: number | null;
  label: string;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRangeKey(value: unknown): value is RangeKey {
  return typeof value === "string" && (RANGE_KEYS as readonly string[]).includes(value);
}

type ParamSource = Record<string, string | string[] | undefined> | URLSearchParams;

function read(params: ParamSource, key: string) {
  if (params instanceof URLSearchParams) return params.get(key);
  const v = params[key];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export function hasFilterParams(params: ParamSource) {
  return ["range", "account", "from", "to"].some((k) => read(params, k) != null);
}

/** Reads the filter from URL params; falls back to the persisted value (cookie) and then the defaults. */
export function parseFilter(params: ParamSource, persisted?: string | null): FilterState {
  let source: ParamSource = params;
  if (!hasFilterParams(params) && persisted) {
    try {
      source = new URLSearchParams(persisted);
    } catch {
      source = params;
    }
  }
  const rangeRaw = read(source, "range");
  const range = isRangeKey(rangeRaw) ? rangeRaw : DEFAULT_RANGE;
  const account = read(source, "account");
  const from = read(source, "from");
  const to = read(source, "to");
  const state: FilterState = {
    range,
    accountId: account && account !== "all" ? account : null,
    from: from && DAY_RE.test(from) ? from : null,
    to: to && DAY_RE.test(to) ? to : null,
  };
  if (state.range === "custom" && (!state.from || !state.to)) return { ...state, range: DEFAULT_RANGE };
  if (state.range === "custom" && state.from && state.to && state.from > state.to) {
    return { ...state, from: state.to, to: state.from };
  }
  return state;
}

/** Serialises the filter for URLs / cookie / localStorage. */
export function filterToQuery(state: FilterState) {
  const params = new URLSearchParams();
  params.set("range", state.range);
  if (state.accountId) params.set("account", state.accountId);
  if (state.range === "custom" && state.from && state.to) {
    params.set("from", state.from);
    params.set("to", state.to);
  }
  return params.toString();
}

function dayStart(dayKeyValue: string, timeZone: string) {
  const [y, m, d] = dayKeyValue.split("-").map(Number);
  return new TZDate(y, m - 1, d, 0, 0, 0, timeZone);
}

/** Computes the UTC bounds of the selected period and of the previous period of equal length. */
export function resolveFilter(
  state: FilterState,
  opts: { timeZone: string; weekStartsOn: number; now?: number },
): ResolvedFilter {
  const now = new TZDate(opts.now ?? Date.now(), opts.timeZone);
  const weekStartsOn = (opts.weekStartsOn % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  let start: Date | null = null;
  let end: Date | null = null;
  let prevStart: Date | null = null;
  let prevEnd: Date | null = null;

  switch (state.range) {
    case "today":
      start = startOfDay(now);
      end = addDays(start, 1);
      prevStart = addDays(start, -1);
      prevEnd = start;
      break;
    case "week":
      start = startOfWeek(now, { weekStartsOn });
      end = addWeeks(start, 1);
      prevStart = addWeeks(start, -1);
      prevEnd = start;
      break;
    case "month":
      start = startOfMonth(now);
      end = addMonths(start, 1);
      prevStart = addMonths(start, -1);
      prevEnd = start;
      break;
    case "30d":
      end = addDays(startOfDay(now), 1);
      start = addDays(end, -30);
      prevStart = addDays(start, -30);
      prevEnd = start;
      break;
    case "quarter":
      start = startOfQuarter(now);
      end = addQuarters(start, 1);
      prevStart = addQuarters(start, -1);
      prevEnd = start;
      break;
    case "year":
      start = startOfYear(now);
      end = addYears(start, 1);
      prevStart = addYears(start, -1);
      prevEnd = start;
      break;
    case "custom": {
      if (state.from && state.to) {
        start = dayStart(state.from, opts.timeZone);
        end = addDays(dayStart(state.to, opts.timeZone), 1);
        const days = differenceInCalendarDays(end, start);
        prevStart = addDays(start, -days);
        prevEnd = start;
      }
      break;
    }
    case "all":
      break;
  }

  return {
    ...state,
    start: start ? start.getTime() : null,
    end: end ? end.getTime() : null,
    prevStart: prevStart ? prevStart.getTime() : null,
    prevEnd: prevEnd ? prevEnd.getTime() : null,
    label: RANGE_LABELS[state.range],
  };
}
