import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/** `YYYY-MM-DDTHH:mm` (datetime-local input value) in the display time zone → UTC ms. */
export function zonedInputToUtc(value: string, timeZone: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number) as unknown as number[];
  const date = new TZDate(y, mo - 1, d, h, mi, Number.isNaN(s) ? 0 : (s ?? 0), timeZone);
  const ts = date.getTime();
  return Number.isFinite(ts) ? ts : null;
}

/** UTC ms → `YYYY-MM-DDTHH:mm` in the display time zone (for datetime-local inputs). */
export function utcToZonedInput(ts: number, timeZone: string) {
  return format(new TZDate(ts, timeZone), "yyyy-MM-dd'T'HH:mm");
}

/** `YYYY-MM-DD` → UTC ms of 00:00 in the display time zone. */
export function dayKeyStart(dayKeyValue: string, timeZone: string) {
  const [y, m, d] = dayKeyValue.split("-").map(Number);
  return new TZDate(y, m - 1, d, 0, 0, 0, timeZone).getTime();
}

/** `YYYY-MM-DD` shifted by `days`. */
export function addDaysToKey(dayKeyValue: string, days: number) {
  const [y, m, d] = dayKeyValue.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function isValidDayKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
