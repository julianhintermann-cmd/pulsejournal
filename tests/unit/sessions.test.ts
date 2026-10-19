import { describe, expect, it } from "vitest";

import { classifySession, DEFAULT_SESSIONS, parseSessionsJson } from "@/lib/sessions";

const TZ = "Europe/Zurich";

// Zurich is UTC+2 in summer (CEST) and UTC+1 in winter (CET).
describe("classifySession", () => {
  it("treats 09:00 as London and 08:59 as Asia (summer time)", () => {
    expect(classifySession(Date.UTC(2026, 6, 15, 7, 0), TZ)).toBe("london");
    expect(classifySession(Date.UTC(2026, 6, 15, 6, 59), TZ)).toBe("asia");
  });

  it("treats 22:00 as off and 21:59 as New York", () => {
    expect(classifySession(Date.UTC(2026, 6, 15, 20, 0), TZ)).toBe("off");
    expect(classifySession(Date.UTC(2026, 6, 15, 19, 59), TZ)).toBe("newyork");
  });

  it("treats 14:30 as New York and 14:29 as London", () => {
    expect(classifySession(Date.UTC(2026, 0, 15, 13, 30), TZ)).toBe("newyork");
    expect(classifySession(Date.UTC(2026, 0, 15, 13, 29), TZ)).toBe("london");
  });

  it("classifies 00:30 and 01:00 local time", () => {
    expect(classifySession(Date.UTC(2026, 0, 14, 23, 30), TZ)).toBe("off");
    expect(classifySession(Date.UTC(2026, 0, 15, 0, 0), TZ)).toBe("asia");
  });

  it("uses local time across the DST change (29 March 2026)", () => {
    // 29 March 2026: clocks jump from 02:00 CET to 03:00 CEST.
    // Before the switch (winter time): 08:59 local = 07:59 UTC.
    expect(classifySession(Date.UTC(2026, 2, 28, 7, 59), TZ)).toBe("asia");
    expect(classifySession(Date.UTC(2026, 2, 28, 8, 0), TZ)).toBe("london");
    // After the switch (summer time): 09:00 local = 07:00 UTC.
    expect(classifySession(Date.UTC(2026, 2, 29, 7, 0), TZ)).toBe("london");
    expect(classifySession(Date.UTC(2026, 2, 29, 6, 59), TZ)).toBe("asia");
    // Same UTC instant 07:00 the day before the switch is 08:00 local → Asia.
    expect(classifySession(Date.UTC(2026, 2, 28, 7, 0), TZ)).toBe("asia");
  });

  it("supports custom windows that wrap past midnight", () => {
    const config = { ...DEFAULT_SESSIONS, asia: { start: "23:00", end: "08:00" } };
    expect(classifySession(Date.UTC(2026, 0, 15, 22, 30), TZ, config)).toBe("asia");
    expect(classifySession(Date.UTC(2026, 0, 15, 6, 30), TZ, config)).toBe("asia");
  });
});

describe("parseSessionsJson", () => {
  it("falls back to defaults on invalid input", () => {
    expect(parseSessionsJson("not json")).toEqual(DEFAULT_SESSIONS);
    expect(parseSessionsJson('{"london":{"start":"25:00","end":"10:00"}}').london).toEqual(DEFAULT_SESSIONS.london);
  });

  it("reads custom windows", () => {
    expect(parseSessionsJson('{"london":{"start":"08:00","end":"13:00"}}').london).toEqual({
      start: "08:00",
      end: "13:00",
    });
  });
});
