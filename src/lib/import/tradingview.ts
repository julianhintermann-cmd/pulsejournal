import Papa from "papaparse";

import type { CsvMapping } from "@/lib/validation";

/**
 * TradingView trade history exports (paper trading, list of trades) have one row per execution: an "Entry long" and
 * an "Exit long" row share the same trade number. They are converted into the one-row-per-trade layout of the
 * regular CSV import, together with the matching column mapping.
 */

const COLUMN_PATTERNS = {
  symbol: /^symbol$/i,
  tradeNumber: /^trade\s*(number|#)$/i,
  type: /^type$/i,
  dateTime: /^(date and time|date\/time)$/i,
  price: /^price(\s+[A-Z]{3})?$/i,
  qty: /^(size \(qty\)|contracts|quantity|qty)$/i,
  netPnl: /^(net pnl|net p&l|profit)(\s+[A-Z]{3})?$/i,
  commission: /^commission(\s+[A-Z]{3})?$/i,
  orderId: /^order id$/i,
} as const;

type Column = keyof typeof COLUMN_PATTERNS;
const REQUIRED: Column[] = ["symbol", "tradeNumber", "type", "dateTime", "price", "qty"];

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

const HEADERS = {
  externalId: "Trade-ID",
  symbol: "Symbol",
  direction: "Richtung",
  openedAt: "Eröffnet",
  closedAt: "Geschlossen",
  entry: "Einstieg",
  exit: "Ausstieg",
  qty: "Menge",
  fees: "Gebühren",
  netPnl: "Netto P&L",
} as const;

export const TRADINGVIEW_MAPPING: CsvMapping = {
  columns: {
    [HEADERS.externalId]: "externalId",
    [HEADERS.symbol]: "symbol",
    [HEADERS.direction]: "direction",
    [HEADERS.openedAt]: "openedAt",
    [HEADERS.closedAt]: "closedAt",
    [HEADERS.entry]: "entry",
    [HEADERS.exit]: "exit",
    [HEADERS.qty]: "qty",
    [HEADERS.fees]: "fees",
    [HEADERS.netPnl]: "netPnl",
  },
  delimiter: ";",
  decimalSeparator: ".",
  dateFormat: "yyyy-MM-dd HH:mm:ss",
  longValue: "Long",
  shortValue: "Short",
};

export type TradingViewConversion = {
  text: string;
  mapping: CsvMapping;
  trades: number;
  rows: number;
  /** Currency of the P&L columns ("Net PnL USD" → "USD"), if the header names one. */
  currency: string | null;
};

function findColumns(headers: string[]) {
  const out: Partial<Record<Column, string>> = {};
  for (const [column, pattern] of Object.entries(COLUMN_PATTERNS) as [Column, RegExp][]) {
    const header = headers.find((h) => pattern.test(h.trim()));
    if (header) out[column] = header;
  }
  return REQUIRED.every((c) => out[c]) ? out : null;
}

/** "Aug 25, 2026, 15:59" or "2026-08-25 15:59[:ss]" → "2026-08-25 15:59:00" (wall clock, no time zone). */
export function normalizeTradingViewDate(raw: string): string | null {
  const value = raw.trim();
  const named = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (named) {
    const month = MONTHS[named[1].toLowerCase()];
    if (!month) return null;
    const [, , day, year, hour, minute, second] = named;
    return `${year}-${month}-${day.padStart(2, "0")} ${hour.padStart(2, "0")}:${minute}:${second ?? "00"}`;
  }
  const iso = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (iso) return `${iso[1]} ${iso[2]}:${iso[3]}:${iso[4] ?? "00"}`;
  return null;
}

function toNumber(raw: string | undefined) {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw.trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Plain decimal string without float noise (e.g. 83118.23583333334 stays, 0.1 + 0.2 becomes 0.3). */
function plain(n: number) {
  return String(Number(n.toPrecision(15)));
}

type Execution = { kind: "entry" | "exit"; direction: "long" | "short"; date: string; price: number; qty: number };

/** Returns the converted CSV when the text is a TradingView trade history export, otherwise null. */
export function convertTradingView(text: string): TradingViewConversion | null {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = parsed.meta.fields ?? [];
  const columns = findColumns(headers);
  if (!columns) return null;
  const col = (row: Record<string, string>, c: Column) => (columns[c] ? (row[columns[c]] ?? "").trim() : "");

  type Group = {
    number: string;
    symbol: string;
    executions: Execution[];
    netPnl: string;
    commission: string;
    orderId: string;
  };
  const groups = new Map<string, Group>();
  for (const row of parsed.data) {
    const number = col(row, "tradeNumber");
    if (!number) continue;
    const group = groups.get(number) ?? { number, symbol: "", executions: [], netPnl: "", commission: "", orderId: "" };
    groups.set(number, group);
    group.symbol ||= col(row, "symbol").split(":").pop() ?? "";
    const type = /^(entry|exit)\s+(long|short)$/i.exec(col(row, "type"));
    const date = normalizeTradingViewDate(col(row, "dateTime"));
    const price = toNumber(col(row, "price"));
    const qty = toNumber(col(row, "qty"));
    // Rows that cannot be read are left out; the trade then fails validation with a precise message.
    if (!type || !date || price == null || qty == null) continue;
    const kind = type[1].toLowerCase() as Execution["kind"];
    group.executions.push({ kind, direction: type[2].toLowerCase() as Execution["direction"], date, price, qty });
    // Net P&L and commission are trade-level values repeated on every row; they are taken from the exit.
    if (kind === "exit") {
      group.netPnl = col(row, "netPnl");
      group.commission = col(row, "commission");
    }
    // The order id of the first entry identifies the trade across repeated exports.
    if (kind === "entry" && !group.orderId) group.orderId = col(row, "orderId");
  }

  const out: Record<string, string>[] = [];
  for (const group of groups.values()) {
    const entries = group.executions.filter((e) => e.kind === "entry");
    const exits = group.executions.filter((e) => e.kind === "exit");
    const direction = (entries[0] ?? exits[0])?.direction;
    const qty = entries.reduce((sum, e) => sum + e.qty, 0);
    const exitQty = exits.reduce((sum, e) => sum + e.qty, 0);
    const avg = (list: Execution[], total: number) => list.reduce((sum, e) => sum + e.price * e.qty, 0) / total;
    // Only a fully closed trade gets exit values; anything else is imported as an open position.
    const closed = exits.length > 0 && qty > 0 && Math.abs(exitQty - qty) < 1e-9;
    out.push({
      [HEADERS.externalId]: group.orderId || `TV-${group.number}`,
      [HEADERS.symbol]: group.symbol,
      [HEADERS.direction]: direction === "long" ? "Long" : direction === "short" ? "Short" : "",
      [HEADERS.openedAt]: entries.map((e) => e.date).sort()[0] ?? "",
      [HEADERS.closedAt]: closed
        ? exits
            .map((e) => e.date)
            .sort()
            .at(-1)!
        : "",
      [HEADERS.entry]: entries.length > 0 ? plain(avg(entries, qty)) : "",
      [HEADERS.exit]: closed ? plain(avg(exits, exitQty)) : "",
      [HEADERS.qty]: qty > 0 ? plain(qty) : "",
      [HEADERS.fees]: closed ? group.commission : "",
      [HEADERS.netPnl]: closed ? group.netPnl : "",
    });
  }
  out.sort((a, b) => a[HEADERS.openedAt].localeCompare(b[HEADERS.openedAt]));

  const pnlHeader = columns.netPnl ?? "";
  const currency = /\s([A-Z]{3})$/.exec(pnlHeader)?.[1] ?? null;
  return {
    text: Papa.unparse(out, { delimiter: ";", columns: Object.values(HEADERS) }),
    mapping: TRADINGVIEW_MAPPING,
    trades: out.length,
    rows: parsed.data.length,
    currency,
  };
}
