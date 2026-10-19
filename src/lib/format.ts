import { TZDate } from "@date-fns/tz";
import { format as formatDateFns } from "date-fns";
import { de } from "date-fns/locale";

/**
 * Number / currency / date formatting for de-CH (section 8.13).
 * Implemented deterministically (instead of Intl) so server and browser render identical strings:
 * grouping uses the typographic apostrophe (1’234.56) and negatives use a true minus sign (−).
 */

export const MINUS = "−";
const GROUP = "’";
export const NBSP = " ";

function groupDigits(int: string) {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP);
}

/** Formats an absolute number with fixed decimals and Swiss grouping (no sign). */
function formatAbs(value: number, decimals: number) {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  return frac ? `${groupDigits(int)}.${frac}` : groupDigits(int);
}

function isNegativeAfterRounding(value: number, decimals: number) {
  return value < 0 && Number(Math.abs(value).toFixed(decimals)) !== 0;
}

export function formatNumber(value: number | null | undefined, decimals = 2, opts: { signed?: boolean } = {}) {
  if (value == null || !Number.isFinite(value)) return "–";
  const negative = isNegativeAfterRounding(value, decimals);
  const positive = !negative && Number(Math.abs(value).toFixed(decimals)) !== 0;
  const sign = negative ? MINUS : opts.signed && positive ? "+" : "";
  return `${sign}${formatAbs(value, decimals)}`;
}

/** Formats a price/quantity with up to `maxDecimals` decimals, trimming trailing zeros down to `minDecimals`. */
export function formatDecimal(value: number | null | undefined, maxDecimals = 5, minDecimals = 0) {
  if (value == null || !Number.isFinite(value)) return "–";
  const [int, rawFrac = ""] = Math.abs(value).toFixed(maxDecimals).split(".");
  let frac = rawFrac.replace(/0+$/, "");
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, "0");
  const body = frac ? `${groupDigits(int)}.${frac}` : groupDigits(int);
  const isZero = Number(`${int}.${frac || "0"}`) === 0;
  return value < 0 && !isZero ? `${MINUS}${body}` : body;
}

/** `CHF 1’234.56`, negative `−CHF 120.00`; with `signed` positive values get a `+` prefix. */
export function formatMoney(
  value: number | null | undefined,
  currency: string,
  opts: { signed?: boolean; decimals?: number } = {},
) {
  if (value == null || !Number.isFinite(value)) return "–";
  const decimals = opts.decimals ?? 2;
  const negative = isNegativeAfterRounding(value, decimals);
  const positive = !negative && Number(Math.abs(value).toFixed(decimals)) !== 0;
  const sign = negative ? MINUS : opts.signed && positive ? "+" : "";
  return `${sign}${currency}${NBSP}${formatAbs(value, decimals)}`;
}

/** Prices: up to 5 decimals, at least 2. */
export function formatPrice(value: number | null | undefined) {
  return formatDecimal(value, 5, 2);
}

/** Compact money for chart axes: `CHF 1.2k`. */
export function formatMoneyCompact(value: number, currency?: string) {
  const abs = Math.abs(value);
  const sign = value < 0 ? MINUS : "";
  let body: string;
  if (abs >= 1_000_000) body = `${formatDecimal(abs / 1_000_000, 1)}M`;
  else if (abs >= 1_000) body = `${formatDecimal(abs / 1_000, 1)}k`;
  else body = formatDecimal(abs, 0);
  return currency ? `${sign}${currency}${NBSP}${body}` : `${sign}${body}`;
}

/** `+2.40R` / `−1.00R`. */
export function formatR(value: number | null | undefined, decimals = 2) {
  if (value == null || !Number.isFinite(value)) return "–";
  return `${formatNumber(value, decimals, { signed: true })}R`;
}

/** Fraction (0.481) → `48.1%`. */
export function formatPercent(fraction: number | null | undefined, opts: { signed?: boolean; decimals?: number } = {}) {
  if (fraction == null || !Number.isFinite(fraction)) return "n/a";
  return `${formatNumber(fraction * 100, opts.decimals ?? 1, { signed: opts.signed })}%`;
}

/** Profit factor / ratios: `2.31`, `∞`. */
export function formatRatio(value: number | null | undefined, decimals = 2) {
  if (value == null) return "n/a";
  if (value === Number.POSITIVE_INFINITY) return "∞";
  if (!Number.isFinite(value)) return "n/a";
  return formatNumber(value, decimals);
}

/** `2 h 15 min`, `45 min`, `3 d 4 h`. */
export function formatDuration(minutes: number | null | undefined) {
  if (minutes == null || !Number.isFinite(minutes)) return "–";
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
}

function zoned(ts: number | Date, timeZone: string) {
  return new TZDate(typeof ts === "number" ? ts : ts.getTime(), timeZone);
}

/** `19.10.2026 14:35` */
export function formatDateTime(ts: number | null | undefined, timeZone: string) {
  if (ts == null) return "–";
  return formatDateFns(zoned(ts, timeZone), "dd.MM.yyyy HH:mm");
}

/** `19.10.2026` */
export function formatDate(ts: number | null | undefined, timeZone: string) {
  if (ts == null) return "–";
  return formatDateFns(zoned(ts, timeZone), "dd.MM.yyyy");
}

/** `14:35` */
export function formatTime(ts: number | null | undefined, timeZone: string) {
  if (ts == null) return "–";
  return formatDateFns(zoned(ts, timeZone), "HH:mm");
}

/** `Montag, 19. Oktober 2026` */
export function formatLongDate(ts: number, timeZone: string) {
  return formatDateFns(zoned(ts, timeZone), "EEEE, d. MMMM yyyy", { locale: de });
}

/** Formats with an arbitrary date-fns pattern in German. */
export function formatPattern(ts: number, timeZone: string, pattern: string) {
  return formatDateFns(zoned(ts, timeZone), pattern, { locale: de });
}

/** Formats a `YYYY-MM-DD` day key (no time zone shift). */
export function formatDayKey(dayKey: string, pattern = "EEEE, d. MMMM yyyy") {
  const [y, m, d] = dayKey.split("-").map(Number);
  return formatDateFns(new Date(y, m - 1, d, 12), pattern, { locale: de });
}

/** `vor 2 Std.`, `gestern`, `vor 3 Tagen`, falls back to the date after 30 days. */
export function formatRelative(ts: number, now: number, timeZone: string) {
  const diff = Math.max(0, now - ts);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "gestern";
  if (days < 30) return `vor ${days} Tagen`;
  return formatDate(ts, timeZone);
}

/** Converts a timestamp into a `YYYY-MM-DD` key in the given time zone. */
export function dayKey(ts: number, timeZone: string) {
  return formatDateFns(zoned(ts, timeZone), "yyyy-MM-dd");
}
