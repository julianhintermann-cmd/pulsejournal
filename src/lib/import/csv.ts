import { tz } from "@date-fns/tz";
import { isValid, parse } from "date-fns";
import Papa from "papaparse";

import type { CsvMapping, CsvTargetField } from "@/lib/validation";

export const CSV_FIELD_LABELS: Record<CsvTargetField | "ignore", string> = {
  symbol: "Symbol",
  direction: "Richtung",
  openedAt: "Eröffnet",
  closedAt: "Geschlossen",
  entry: "Einstieg",
  exit: "Ausstieg",
  qty: "Menge",
  stop: "Stop Loss",
  target: "Take Profit",
  fees: "Gebühren",
  swap: "Swap",
  netPnl: "Netto P&L",
  notes: "Notizen",
  ignore: "Ignorieren",
};

export const DATE_FORMATS = [
  "dd.MM.yyyy HH:mm",
  "dd.MM.yyyy HH:mm:ss",
  "yyyy-MM-dd HH:mm",
  "yyyy-MM-dd HH:mm:ss",
  "yyyy-MM-dd'T'HH:mm:ss",
  "yyyy.MM.dd HH:mm:ss",
  "MM/dd/yyyy HH:mm",
  "dd/MM/yyyy HH:mm",
] as const;

export type ParsedCsv = { headers: string[]; rows: Record<string, string>[] };

export function parseCsv(text: string, delimiter: CsvMapping["delimiter"]): ParsedCsv {
  const clean = text.replace(/^﻿/, "");
  const result = Papa.parse<Record<string, string>>(clean, {
    header: true,
    delimiter,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = (result.meta.fields ?? []).filter((h) => h.length > 0);
  return { headers, rows: result.data };
}

/** Guesses the decimal separator from sample data rows (dates and times are ignored). */
export function detectDecimalSeparator(text: string, delimiter: CsvMapping["delimiter"]): "." | "," {
  if (delimiter === ",") return ".";
  const sample = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .slice(1, 30)
    .join("\n")
    .replace(/\d{1,4}[./-]\d{1,2}[./-]\d{1,4}/g, " ")
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, " ");
  const comma = (sample.match(/\d,\d/g) ?? []).length;
  const dot = (sample.match(/\d\.\d/g) ?? []).length;
  return comma > dot ? "," : ".";
}

/** Guesses the delimiter from the first line. */
export function detectDelimiter(text: string): CsvMapping["delimiter"] {
  const line = text.replace(/^﻿/, "").split(/\r?\n/)[0] ?? "";
  const counts = ([",", ";", "\t", "|"] as const).map((d) => ({ d, n: line.split(d).length - 1 }));
  return counts.sort((a, b) => b.n - a.n)[0].n > 0 ? counts[0].d : ",";
}

const GUESSES: [RegExp, CsvTargetField][] = [
  [/^(symbol|instrument|ticker|asset|markt|market)$/i, "symbol"],
  [/^(direction|side|richtung|type|typ)$/i, "direction"],
  [/(open(ed)?|entry|einstieg).*(time|date|zeit|datum)|^(opened|eröffnet|open time|datum)$/i, "openedAt"],
  [/(close(d)?|exit|ausstieg).*(time|date|zeit|datum)|^(closed|geschlossen)$/i, "closedAt"],
  [/^(entry|entry price|open price|einstieg|einstiegspreis|price)$/i, "entry"],
  [/^(exit|exit price|close price|ausstieg|ausstiegspreis)$/i, "exit"],
  [/^(qty|quantity|size|volume|lots?|menge|anzahl|contracts)$/i, "qty"],
  [/^(sl|stop|stop loss|stoploss)$/i, "stop"],
  [/^(tp|target|take profit|takeprofit)$/i, "target"],
  [/^(fee|fees|commission|commissions|gebühr|gebühren)$/i, "fees"],
  [/^(swap|rollover|financing)$/i, "swap"],
  [/^(pnl|p&l|profit|net pnl|net p&l|netto p&l|gewinn)$/i, "netPnl"],
  [/^(notes?|comment|kommentar|notiz|notizen)$/i, "notes"],
];

/** Suggests a target field for each header (first match wins, each target used once). */
export function guessColumns(headers: string[]): Record<string, CsvTargetField | "ignore"> {
  const used = new Set<CsvTargetField>();
  const out: Record<string, CsvTargetField | "ignore"> = {};
  for (const h of headers) {
    const match = GUESSES.find(([re, field]) => !used.has(field) && re.test(h.trim()));
    if (match) {
      out[h] = match[1];
      used.add(match[1]);
    } else out[h] = "ignore";
  }
  return out;
}

/** Number parsing honouring the configured decimal separator (thousands separators are stripped). */
export function parseNumber(raw: string | undefined, decimal: "." | ","): number | null {
  if (raw == null) return null;
  let s = raw
    .trim()
    .replace(/[\s '’]/g, "")
    .replace(/−/g, "-");
  if (s === "") return null;
  s = decimal === "," ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return Number.NaN;
  return Number(s);
}

export function parseDate(raw: string | undefined, format: string, timeZone: string): number | null {
  if (!raw || !raw.trim()) return null;
  const value = raw.trim();
  const date = parse(value, format, new Date(), { in: tz(timeZone) });
  if (isValid(date)) return date.getTime();
  // Allow a date-only value for formats with time.
  const dateOnly = format.split(" ")[0];
  if (dateOnly !== format) {
    const d = parse(value, dateOnly, new Date(), { in: tz(timeZone) });
    if (isValid(d)) return d.getTime();
  }
  return Number.NaN;
}

export type MappedRow = {
  symbol: string;
  direction: "long" | "short";
  openedAt: number;
  closedAt: number | null;
  entry: number;
  exit: number | null;
  qty: number;
  stop: number | null;
  target: number | null;
  fees: number;
  swap: number;
  netPnl: number | null;
  notes: string | null;
};

export type RowResult = { index: number; ok: true; row: MappedRow } | { index: number; ok: false; error: string };

function directionOf(value: string | undefined, mapping: CsvMapping): "long" | "short" | null {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return null;
  const longValues = [mapping.longValue, "long", "buy", "kauf", "b"].map((x) => x.trim().toLowerCase()).filter(Boolean);
  const shortValues = [mapping.shortValue, "short", "sell", "verkauf", "s"]
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (longValues.includes(v)) return "long";
  if (shortValues.includes(v)) return "short";
  return null;
}

/** Applies a column mapping to one CSV row and validates it. */
export function mapRow(raw: Record<string, string>, index: number, mapping: CsvMapping, timeZone: string): RowResult {
  const get = (field: CsvTargetField) => {
    const column = Object.entries(mapping.columns).find(([, target]) => target === field)?.[0];
    return column ? raw[column] : undefined;
  };
  const num = (field: CsvTargetField) => parseNumber(get(field), mapping.decimalSeparator);
  const fail = (error: string): RowResult => ({ index, ok: false, error });

  const symbol = (get("symbol") ?? "").trim().toUpperCase();
  if (!symbol) return fail("Symbol fehlt.");
  if (!/^[A-Z0-9._/!:-]{1,30}$/.test(symbol)) return fail(`Ungültiges Symbol „${symbol}“.`);
  const direction = directionOf(get("direction"), mapping);
  if (!direction) return fail(`Richtung „${get("direction") ?? ""}“ nicht erkannt.`);
  const openedAt = parseDate(get("openedAt"), mapping.dateFormat, timeZone);
  if (openedAt == null) return fail("Eröffnungsdatum fehlt.");
  if (Number.isNaN(openedAt)) return fail(`Datum „${get("openedAt")}“ passt nicht zu ${mapping.dateFormat}.`);
  const closedAt = parseDate(get("closedAt"), mapping.dateFormat, timeZone);
  if (closedAt != null && Number.isNaN(closedAt))
    return fail(`Datum „${get("closedAt")}“ passt nicht zu ${mapping.dateFormat}.`);

  const values = {
    entry: num("entry"),
    exit: num("exit"),
    qty: num("qty"),
    stop: num("stop"),
    target: num("target"),
    fees: num("fees"),
    swap: num("swap"),
    netPnl: num("netPnl"),
  };
  for (const [key, value] of Object.entries(values)) {
    if (value != null && Number.isNaN(value))
      return fail(`${CSV_FIELD_LABELS[key as CsvTargetField]}: keine gültige Zahl.`);
  }
  if (values.qty == null || values.qty <= 0) return fail("Menge fehlt oder ist nicht grösser als 0.");
  if (values.entry == null) return fail("Einstieg fehlt.");
  if (values.entry <= 0) return fail("Einstieg muss grösser als 0 sein.");
  if (values.exit != null && values.exit <= 0) return fail("Ausstieg muss grösser als 0 sein.");
  if (values.exit != null && closedAt == null) return fail("Ausstieg ohne Schliessungsdatum.");
  if (closedAt != null && closedAt < openedAt) return fail("Geschlossen liegt vor Eröffnet.");
  if (values.stop != null) {
    const wrong = direction === "long" ? values.stop >= values.entry : values.stop <= values.entry;
    if (wrong) return fail("Stop Loss liegt auf der falschen Seite des Einstiegs.");
  }
  const notes = (get("notes") ?? "").trim();

  return {
    index,
    ok: true,
    row: {
      symbol,
      direction,
      openedAt,
      closedAt,
      entry: values.entry,
      exit: values.exit,
      qty: values.qty,
      stop: values.stop,
      target: values.target,
      fees: Math.abs(values.fees ?? 0),
      swap: values.swap ?? 0,
      netPnl: values.netPnl,
      notes: notes ? notes.slice(0, 20_000) : null,
    },
  };
}

export function mapRows(parsed: ParsedCsv, mapping: CsvMapping, timeZone: string) {
  return parsed.rows.map((raw, i) => mapRow(raw, i, mapping, timeZone));
}

/** Input of the dedupe hash: account_id|symbol|direction|opened_at|entry_avg|qty. */
export function dedupeKey(
  accountId: string,
  row: Pick<MappedRow, "symbol" | "direction" | "openedAt" | "entry" | "qty">,
) {
  return [accountId, row.symbol, row.direction, row.openedAt, row.entry, row.qty].join("|");
}
