import { describe, expect, it } from "vitest";

import { dedupeKey, mapRows, parseCsv } from "@/lib/import/csv";
import { convertTradingView, normalizeTradingViewDate } from "@/lib/import/tradingview";

const HEADER =
  "Symbol,Trade number,Type,Date and time,Order ID,Signal,Price,Size (qty),Size (value),Net PnL USD,Return %,Commission USD,Cumulative PnL USD,Cumulative PnL %";

// Rows taken from a TradingView paper trading export (exit row first, like the original file).
const SAMPLE = [
  HEADER,
  'NASDAQ:AAPL,1,Exit long,"Aug 25, 2026, 15:59",3446193074,3446193074,310.04,100,31032,-28,-0.09,0,-28,-0.03',
  'NASDAQ:AAPL,1,Entry long,"Aug 25, 2026, 15:42",3446192037,3446192037,310.32,100,31032,-28,-0.09,0,-28,-0.03',
  'CRYPTO:BTCUSD,4,Exit short,"Oct 13, 2026, 21:22",3669429770,3669429770,83179.18,10,831463.3,-328.5,-0.04,0,-118.53,-0.12',
  'CRYPTO:BTCUSD,4,Entry short,"Oct 13, 2026, 21:04",3669428804,3669428804,83146.33,10,831463.3,-328.5,-0.04,0,-118.53,-0.12',
  'BINANCE:BTCUSDT,23,Exit long,"Oct 14, 2026, 13:47",3671936122,3671936122,83462,5.5397,462354.49679699994,-0.06,0,0,-7623.66,-7.62',
  'BINANCE:BTCUSDT,23,Entry long,"Oct 14, 2026, 13:47",3671935644,3671935644,83462.01,5.5397,462354.49679699994,-0.06,0,0,-7623.66,-7.62',
  'BINANCE:BTCUSDT,24,Exit long,"Oct 14, 2026, 13:47",3671936446,3671936446,83463.96,5.5397,462354.49679699994,10.79,0,0,-7612.87,-7.61',
  'BINANCE:BTCUSDT,24,Entry long,"Oct 14, 2026, 13:47",3671936235,3671936235,83462.01,5.5397,462354.49679699994,10.79,0,0,-7612.87,-7.61',
  'COMEX:GC1!,40,Exit short,"Oct 15, 2026, 18:06",3679275757,3679275757,4169.2,1,4170,80,0.02,0,-5705.29,-5.71',
  'COMEX:GC1!,40,Entry short,"Oct 15, 2026, 18:05",3679271649,3679271649,4170,1,4170,80,0.02,0,-5705.29,-5.71',
  'BINANCE:ETHUSDT.P,48,Entry long,"Oct 19, 2026, 10:02",3690100000,3690100000,2440.5,50,122025,0,0,0,14427.01,14.43',
].join("\n");

describe("TradingView trade history import", () => {
  it("normalizes TradingView date formats", () => {
    expect(normalizeTradingViewDate("Aug 25, 2026, 15:59")).toBe("2026-08-25 15:59:00");
    expect(normalizeTradingViewDate("Oct 3, 2026, 09:05:12")).toBe("2026-10-03 09:05:12");
    expect(normalizeTradingViewDate("2026-10-03 09:05")).toBe("2026-10-03 09:05:00");
    expect(normalizeTradingViewDate("03.10.2026 09:05")).toBeNull();
  });

  it("ignores other CSV files", () => {
    expect(convertTradingView("Symbol;Richtung;Eröffnet\nEURUSD;Long;01.01.2026 10:00")).toBeNull();
  });

  it("combines entry and exit rows into one trade per trade number", () => {
    const tv = convertTradingView(SAMPLE)!;
    expect(tv).not.toBeNull();
    expect(tv.trades).toBe(6);
    expect(tv.rows).toBe(11);
    expect(tv.currency).toBe("USD");

    const results = mapRows(parseCsv(tv.text, tv.mapping.delimiter), tv.mapping, "Europe/Zurich");
    expect(results.every((r) => r.ok)).toBe(true);
    const rows = results.flatMap((r) => (r.ok ? [r.row] : []));

    const aapl = rows[0];
    expect(aapl).toMatchObject({
      symbol: "AAPL",
      direction: "long",
      entry: 310.32,
      exit: 310.04,
      qty: 100,
      netPnl: -28,
      fees: 0,
      externalId: "3446192037",
    });
    // 15:42 in Zurich (CEST, UTC+2) is 13:42 UTC.
    expect(new Date(aapl.openedAt).toISOString()).toBe("2026-08-25T13:42:00.000Z");
    expect(new Date(aapl.closedAt!).toISOString()).toBe("2026-08-25T13:59:00.000Z");

    expect(rows.find((r) => r.symbol === "BTCUSD")).toMatchObject({
      direction: "short",
      entry: 83146.33,
      netPnl: -328.5,
    });
    expect(rows.find((r) => r.symbol === "GC1!")).toMatchObject({ direction: "short", exit: 4169.2, netPnl: 80 });

    // A position without exit row is imported as an open trade.
    expect(rows.find((r) => r.symbol === "ETHUSDT.P")).toMatchObject({ closedAt: null, exit: null, netPnl: null });
  });

  it("keeps trades apart that only differ by their order id", () => {
    const tv = convertTradingView(SAMPLE)!;
    const rows = mapRows(parseCsv(tv.text, tv.mapping.delimiter), tv.mapping, "Europe/Zurich").flatMap((r) =>
      r.ok ? [r.row] : [],
    );
    const btc = rows.filter((r) => r.symbol === "BTCUSDT");
    expect(btc).toHaveLength(2);
    expect(btc[0].openedAt).toBe(btc[1].openedAt);
    expect(dedupeKey("acc", btc[0])).not.toBe(dedupeKey("acc", btc[1]));
  });
});
