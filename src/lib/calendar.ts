/** Month grid helpers (pure, timezone-free: operate on `YYYY-MM-DD` keys). */

export type MonthKey = { year: number; month: number }; // month 1–12

export function parseMonthKey(value: string | undefined | null): MonthKey | null {
  const match = value ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), month };
}

export function monthKeyString({ year, month }: MonthKey) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftMonth({ year, month }: MonthKey, delta: number): MonthKey {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function key(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Weeks of the month; each week has 7 cells (`null` outside the month). */
export function monthGrid({ year, month }: MonthKey, weekStartsOn: number) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = Sunday
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (first - weekStartsOn + 7) % 7;
  const cells: (string | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: days }, (_, i) => key(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Weekday labels in display order for the given week start. */
export function weekdayLabels(weekStartsOn: number) {
  const sundayFirst = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return Array.from({ length: 7 }, (_, i) => sundayFirst[(weekStartsOn + i) % 7]);
}

export function monthBounds({ year, month }: MonthKey) {
  return { from: key(year, month, 1), to: key(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate()) };
}
