import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  dedupeKey,
  detectDecimalSeparator,
  detectDelimiter,
  guessColumns,
  mapRows,
  parseCsv,
  parseNumber,
} from "@/lib/import/csv";
import { importHash } from "@/lib/import/run";
import type { CsvMapping } from "@/lib/validation";

const CSV = [
  "Symbol;Richtung;Eröffnet;Geschlossen;Einstieg;Ausstieg;Menge;Stop Loss;Gebühren;Notizen",
  "eurusd;Kauf;19.10.2026 09:15;19.10.2026 11:30;1,08450;1,08720;0,5;1,08300;3,50;Gut",
  "XAUUSD;Verkauf;20.10.2026 14:31;;2’650,10;;1;2’660,00;;",
  "NAS100;Seitwärts;20.10.2026 15:00;;20500;;1;;;",
  "BTCUSD;Kauf;32.10.2026 15:00;;67000;;1;;;",
].join("\n");

const mapping: CsvMapping = {
  columns: {
    Symbol: "symbol",
    Richtung: "direction",
    Eröffnet: "openedAt",
    Geschlossen: "closedAt",
    Einstieg: "entry",
    Ausstieg: "exit",
    Menge: "qty",
    "Stop Loss": "stop",
    Gebühren: "fees",
    Notizen: "notes",
  },
  delimiter: ";",
  decimalSeparator: ",",
  dateFormat: "dd.MM.yyyy HH:mm",
  longValue: "Kauf",
  shortValue: "Verkauf",
};

describe("CSV import mapping", () => {
  it("detects the delimiter and guesses columns", () => {
    expect(detectDelimiter(CSV)).toBe(";");
    expect(detectDecimalSeparator(CSV, ";")).toBe(",");
    expect(detectDecimalSeparator("a;b\n19.10.2026 09:15;1.25", ";")).toBe(".");
    const parsed = parseCsv(CSV, ";");
    const guess = guessColumns(parsed.headers);
    expect(guess.Symbol).toBe("symbol");
    expect(guess.Menge).toBe("qty");
    expect(guess.Notizen).toBe("notes");
  });

  it("parses comma decimals and dd.MM.yyyy HH:mm dates in the display time zone", () => {
    const results = mapRows(parseCsv(CSV, ";"), mapping, "Europe/Zurich");
    const first = results[0];
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.row.symbol).toBe("EURUSD");
    expect(first.row.direction).toBe("long");
    expect(first.row.entry).toBeCloseTo(1.0845, 10);
    expect(first.row.exit).toBeCloseTo(1.0872, 10);
    expect(first.row.qty).toBe(0.5);
    expect(first.row.fees).toBe(3.5);
    expect(first.row.openedAt).toBe(Date.UTC(2026, 9, 19, 7, 15)); // 09:15 CEST
    expect(first.row.closedAt).toBe(Date.UTC(2026, 9, 19, 9, 30));

    const second = results[1];
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.row.direction).toBe("short");
      expect(second.row.entry).toBeCloseTo(2650.1, 10);
      expect(second.row.closedAt).toBeNull();
    }
  });

  it("reports invalid rows", () => {
    const results = mapRows(parseCsv(CSV, ";"), mapping, "Europe/Zurich");
    expect(results[2]).toMatchObject({ ok: false });
    expect(results[3]).toMatchObject({ ok: false });
  });

  it("parses numbers with both separators", () => {
    expect(parseNumber("1.234,56", ",")).toBe(1234.56);
    expect(parseNumber("1,234.56", ".")).toBe(1234.56);
    expect(parseNumber("−12,5", ",")).toBe(-12.5);
    expect(Number.isNaN(parseNumber("abc", "."))).toBe(true);
    expect(parseNumber("", ".")).toBeNull();
  });

  it("builds the dedupe hash from account|symbol|direction|opened_at|entry|qty", () => {
    const row = { symbol: "EURUSD", direction: "long" as const, openedAt: 1_700_000_000_000, entry: 1.0845, qty: 0.5 };
    expect(dedupeKey("acc-1", row)).toBe("acc-1|EURUSD|long|1700000000000|1.0845|0.5");
    const expected = createHash("sha256").update("acc-1|EURUSD|long|1700000000000|1.0845|0.5").digest("hex");
    expect(
      importHash("acc-1", {
        ...row,
        closedAt: null,
        exit: null,
        stop: null,
        target: null,
        fees: 0,
        swap: 0,
        netPnl: null,
        notes: null,
        externalId: null,
      }),
    ).toBe(expected);
    expect(
      importHash("acc-2", {
        ...row,
        closedAt: null,
        exit: null,
        stop: null,
        target: null,
        fees: 0,
        swap: 0,
        netPnl: null,
        notes: null,
        externalId: null,
      }),
    ).not.toBe(expected);
  });
});
