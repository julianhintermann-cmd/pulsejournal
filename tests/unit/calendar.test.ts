import { describe, expect, it } from "vitest";

import { monthGrid, shiftMonth, weekdayLabels } from "@/lib/calendar";

describe("calendar", () => {
  it("builds a Monday-first grid for October 2026", () => {
    const weeks = monthGrid({ year: 2026, month: 10 }, 1);
    // 1 Oct 2026 is a Thursday → three empty cells first.
    expect(weeks[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("shifts months across years and labels weekdays", () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(weekdayLabels(1)[0]).toBe("Mo");
    expect(weekdayLabels(0)[0]).toBe("So");
  });
});
