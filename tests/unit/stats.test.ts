import { describe, expect, it } from "vitest";

import {
  balanceCurve,
  computeMetrics,
  maxDrawdown,
  profitFactor,
  R_BUCKETS,
  rBucketIndex,
  rHistogram,
  streaks,
  winRate,
  type StatTrade,
} from "@/lib/stats/metrics";

let seq = 0;
function trade(netPnl: number, result: StatTrade["result"], r: number | null = null): StatTrade {
  seq += 1;
  return {
    id: `t${seq}`,
    netPnl,
    rMultiple: r,
    result,
    closedAt: 1_000 * seq,
    openedAt: 1_000 * seq - 500,
    holdMinutes: 10,
  };
}

describe("win rate", () => {
  it("excludes break-even trades", () => {
    const trades = [trade(10, "win"), trade(-5, "loss"), trade(0, "be"), trade(0, "be")];
    expect(winRate(trades)).toBe(0.5);
  });

  it("returns null when there are only break-even trades", () => {
    expect(winRate([trade(0, "be")])).toBeNull();
  });
});

describe("profit factor", () => {
  it("is ∞ with wins and no losses", () => {
    expect(profitFactor([trade(10, "win"), trade(5, "win")])).toBe(Number.POSITIVE_INFINITY);
  });

  it("is null without wins and losses", () => {
    expect(profitFactor([])).toBeNull();
  });

  it("divides gross profit by gross loss", () => {
    expect(profitFactor([trade(30, "win"), trade(-10, "loss"), trade(-5, "loss")])).toBe(2);
  });
});

describe("computeMetrics", () => {
  it("computes expectancy, payoff and R figures", () => {
    const trades = [trade(200, "win", 2), trade(-100, "loss", -1), trade(100, "win", 1), trade(0, "be", 0)];
    const m = computeMetrics(trades);
    expect(m.netPnl).toBe(200);
    expect(m.trades).toBe(4);
    expect(m.expectancy).toBe(50);
    expect(m.expectancyR).toBe(0.5);
    expect(m.totalR).toBe(2);
    expect(m.avgWin).toBe(150);
    expect(m.avgLoss).toBe(-100);
    expect(m.payoffRatio).toBe(1.5);
    expect(m.best).toBe(200);
    expect(m.worst).toBe(-100);
    expect(m.winRate).toBeCloseTo(2 / 3, 10);
  });

  it("computes rules followed percentage over trades with a playbook", () => {
    const a = { ...trade(10, "win"), rules: { checked: 4, total: 5 } };
    const b = { ...trade(-10, "loss"), rules: { checked: 1, total: 5 } };
    const c = { ...trade(5, "win"), rules: null };
    expect(computeMetrics([a, b, c]).rulesFollowed).toBe(0.5);
  });
});

describe("streaks", () => {
  it("ignores break-even trades in between", () => {
    const trades = [
      trade(10, "win"),
      trade(0, "be"),
      trade(10, "win"),
      trade(10, "win"),
      trade(-5, "loss"),
      trade(0, "be"),
      trade(-5, "loss"),
    ];
    const s = streaks(trades);
    expect(s.longestWin).toBe(3);
    expect(s.longestLoss).toBe(2);
    expect(s.current).toEqual({ type: "loss", length: 2 });
  });

  it("orders by close time", () => {
    const late = { ...trade(10, "win"), closedAt: 10_000_000 };
    const early = { ...trade(-5, "loss"), closedAt: 1 };
    expect(streaks([late, early]).current).toEqual({ type: "win", length: 1 });
  });
});

describe("max drawdown", () => {
  it("includes deposits in the balance curve", () => {
    const trades = [
      { id: "a", netPnl: 1_000, closedAt: 10 },
      { id: "b", netPnl: -1_500, closedAt: 30 },
      { id: "c", netPnl: 200, closedAt: 40 },
    ];
    const cash = [{ occurredAt: 20, type: "deposit" as const, amount: 5_000 }];
    const curve = balanceCurve(10_000, cash, trades, 0);
    expect(curve.map((p) => p.balance)).toEqual([10_000, 11_000, 16_000, 14_500, 14_700]);
    const dd = maxDrawdown(curve);
    expect(dd.amount).toBe(1_500);
    expect(dd.percent).toBeCloseTo(1_500 / 16_000, 10);
  });

  it("counts withdrawals and fees as negative cash flows", () => {
    const curve = balanceCurve(
      1_000,
      [
        { occurredAt: 1, type: "withdrawal", amount: 100 },
        { occurredAt: 2, type: "fee", amount: 10 },
        { occurredAt: 3, type: "payout", amount: 50 },
      ],
      [],
      0,
    );
    expect(curve.at(-1)?.balance).toBe(840);
  });

  it("is zero on a rising curve", () => {
    expect(
      maxDrawdown([
        { ts: 0, balance: 1 },
        { ts: 1, balance: 2 },
      ]).amount,
    ).toBe(0);
  });
});

describe("R histogram", () => {
  it("assigns bucket boundaries symmetrically", () => {
    expect(R_BUCKETS[rBucketIndex(-2)]).toBe("≤ −2");
    expect(R_BUCKETS[rBucketIndex(-1.5)]).toBe("−2…−1");
    expect(R_BUCKETS[rBucketIndex(-1)]).toBe("−2…−1");
    expect(R_BUCKETS[rBucketIndex(-0.2)]).toBe("−1…0");
    expect(R_BUCKETS[rBucketIndex(0)]).toBe("0…1");
    expect(R_BUCKETS[rBucketIndex(1)]).toBe("1…2");
    expect(R_BUCKETS[rBucketIndex(2.99)]).toBe("2…3");
    expect(R_BUCKETS[rBucketIndex(3)]).toBe("≥ 3");
  });

  it("counts and reports mean and median", () => {
    const h = rHistogram([-1, -1, 0.5, 2, 4]);
    expect(h.buckets.map((b) => b.count)).toEqual([0, 2, 0, 1, 0, 1, 1]);
    expect(h.mean).toBe(0.9);
    expect(h.median).toBe(0.5);
  });
});
