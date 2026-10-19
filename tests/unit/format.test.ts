import { describe, expect, it } from "vitest";

import {
  formatDateTime,
  formatDuration,
  formatLongDate,
  formatMoney,
  formatPercent,
  formatR,
  formatRatio,
  formatRelative,
} from "@/lib/format";

describe("format", () => {
  it("formats money in de-CH with a true minus sign", () => {
    expect(formatMoney(1234.56, "CHF")).toBe("CHF 1’234.56");
    expect(formatMoney(-120, "CHF")).toBe("−CHF 120.00");
    expect(formatMoney(15, "USD", { signed: true })).toBe("+USD 15.00");
    expect(formatMoney(-0.001, "CHF")).toBe("CHF 0.00");
  });

  it("formats R, percentages and ratios", () => {
    expect(formatR(2.4)).toBe("+2.40R");
    expect(formatR(-1)).toBe("−1.00R");
    expect(formatPercent(0.4812)).toBe("48.1%");
    expect(formatPercent(null)).toBe("n/a");
    expect(formatRatio(Number.POSITIVE_INFINITY)).toBe("∞");
  });

  it("formats durations", () => {
    expect(formatDuration(135)).toBe("2 h 15 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
  });

  it("formats dates in the display time zone", () => {
    const ts = Date.UTC(2026, 9, 19, 12, 35);
    expect(formatDateTime(ts, "Europe/Zurich")).toBe("19.10.2026 14:35");
    expect(formatLongDate(ts, "Europe/Zurich")).toBe("Montag, 19. Oktober 2026");
  });

  it("formats relative times", () => {
    const now = Date.UTC(2026, 9, 19, 12, 0);
    expect(formatRelative(now - 2 * 3_600_000, now, "Europe/Zurich")).toBe("vor 2 Std.");
    expect(formatRelative(now - 5 * 60_000, now, "Europe/Zurich")).toBe("vor 5 Min.");
  });
});
