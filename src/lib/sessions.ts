import { TZDate } from "@date-fns/tz";

import type { TradingSession } from "@/lib/db/schema";

export type SessionWindow = { start: string; end: string };
export type SessionsConfig = Record<Exclude<TradingSession, "off">, SessionWindow>;

export const DEFAULT_SESSIONS: SessionsConfig = {
  asia: { start: "01:00", end: "09:00" },
  london: { start: "09:00", end: "14:30" },
  newyork: { start: "14:30", end: "22:00" },
};

export const SESSION_LABELS: Record<TradingSession, string> = {
  asia: "Asien",
  london: "London",
  newyork: "New York",
  off: "Ausserhalb",
};

export const SESSION_ORDER: TradingSession[] = ["asia", "london", "newyork", "off"];

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string) {
  return TIME_RE.test(value);
}

function toMinutes(value: string) {
  const match = TIME_RE.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Parses the settings JSON, falling back to the defaults for missing or invalid windows. */
export function parseSessionsJson(json: string | null | undefined): SessionsConfig {
  let raw: unknown = null;
  try {
    raw = json ? JSON.parse(json) : null;
  } catch {
    raw = null;
  }
  const result: SessionsConfig = { ...DEFAULT_SESSIONS };
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(DEFAULT_SESSIONS) as (keyof SessionsConfig)[]) {
      const w = (raw as Record<string, unknown>)[key] as Partial<SessionWindow> | undefined;
      if (w && typeof w.start === "string" && typeof w.end === "string" && isValidTime(w.start) && isValidTime(w.end)) {
        result[key] = { start: w.start, end: w.end };
      }
    }
  }
  return result;
}

function inWindow(minute: number, window: SessionWindow) {
  const start = toMinutes(window.start);
  const end = toMinutes(window.end);
  if (start == null || end == null || start === end) return false;
  if (start < end) return minute >= start && minute < end;
  // Window wraps past midnight.
  return minute >= start || minute < end;
}

/**
 * Classifies an entry timestamp into a trading session. Windows are start-inclusive and end-exclusive
 * and interpreted in the display time zone.
 */
export function classifySession(timestamp: number, timeZone: string, config: SessionsConfig = DEFAULT_SESSIONS) {
  const local = new TZDate(timestamp, timeZone);
  const minute = local.getHours() * 60 + local.getMinutes();
  for (const key of ["asia", "london", "newyork"] as const) {
    if (inWindow(minute, config[key])) return key;
  }
  return "off" as const;
}
