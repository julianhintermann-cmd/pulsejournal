import { describe, expect, it } from "vitest";

import { filterToQuery, parseFilter, resolveFilter } from "@/lib/filter";

const TZ = "Europe/Zurich";
const NOW = Date.UTC(2026, 9, 19, 10, 0); // Monday 19 Oct 2026, 12:00 in Zurich

describe("filter", () => {
  it("defaults to this month", () => {
    const f = resolveFilter(parseFilter({}), { timeZone: TZ, weekStartsOn: 1, now: NOW });
    expect(f.range).toBe("month");
    expect(f.start).toBe(Date.UTC(2026, 8, 30, 22, 0)); // 1 Oct 00:00 CEST
    expect(f.end).toBe(Date.UTC(2026, 9, 31, 23, 0)); // 1 Nov 00:00 CET
    expect(f.prevStart).toBe(Date.UTC(2026, 7, 31, 22, 0));
    expect(f.prevEnd).toBe(f.start);
  });

  it("computes the week with Monday start", () => {
    const f = resolveFilter(parseFilter({ range: "week" }), { timeZone: TZ, weekStartsOn: 1, now: NOW });
    expect(f.start).toBe(Date.UTC(2026, 9, 18, 22, 0));
  });

  it("resolves custom inclusive ranges and their previous period", () => {
    const f = resolveFilter(parseFilter({ range: "custom", from: "2026-10-01", to: "2026-10-10" }), {
      timeZone: TZ,
      weekStartsOn: 1,
      now: NOW,
    });
    expect(f.end! - f.start!).toBe(10 * 86_400_000);
    expect(f.prevEnd).toBe(f.start);
    expect(f.prevStart).toBe(f.start! - 10 * 86_400_000);
  });

  it("falls back to the persisted query and round-trips", () => {
    const state = parseFilter({}, "range=year&account=abc");
    expect(state).toEqual({ range: "year", accountId: "abc", from: null, to: null });
    expect(filterToQuery(state)).toBe("range=year&account=abc");
    expect(parseFilter({ range: "all" }, "range=year").range).toBe("all");
  });

  it("is unbounded for all", () => {
    const f = resolveFilter(parseFilter({ range: "all" }), { timeZone: TZ, weekStartsOn: 1, now: NOW });
    expect(f.start).toBeNull();
    expect(f.prevStart).toBeNull();
  });
});
