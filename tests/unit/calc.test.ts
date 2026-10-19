import { describe, expect, it } from "vitest";

import {
  CALC_ERRORS,
  classifyResult,
  computeTrade,
  plannedRisk,
  plannedRiskReward,
  positionSize,
  TradeCalcError,
  validateTradeCalc,
  weightedAverage,
  type TradeCalcInput,
} from "@/lib/calc/trade";

const T0 = Date.UTC(2026, 9, 19, 8, 0);
const MIN = 60_000;

function input(overrides: Partial<TradeCalcInput>): TradeCalcInput {
  return {
    direction: "long",
    executions: [],
    multiplier: 1,
    fxRate: 1,
    fees: 0,
    swap: 0,
    pnlMode: "auto",
    manualNetPnl: null,
    initialStop: null,
    beThreshold: 0,
    ...overrides,
  };
}

describe("computeTrade – P&L", () => {
  it("computes a closed long trade", () => {
    const r = computeTrade(
      input({
        executions: [
          { side: "buy", qty: 2, price: 100, fee: 0, executedAt: T0 },
          { side: "sell", qty: 2, price: 110, fee: 0, executedAt: T0 + 90 * MIN },
        ],
      }),
    );
    expect(r.status).toBe("closed");
    expect(r.entryAvg).toBe(100);
    expect(r.exitAvg).toBe(110);
    expect(r.grossPnl).toBe(20);
    expect(r.netPnl).toBe(20);
    expect(r.result).toBe("win");
    expect(r.openedAt).toBe(T0);
    expect(r.closedAt).toBe(T0 + 90 * MIN);
  });

  it("computes a closed short trade", () => {
    const r = computeTrade(
      input({
        direction: "short",
        multiplier: 10,
        executions: [
          { side: "sell", qty: 1, price: 50, fee: 0, executedAt: T0 },
          { side: "buy", qty: 1, price: 53, fee: 0, executedAt: T0 + MIN },
        ],
      }),
    );
    expect(r.grossPnl).toBe(-30);
    expect(r.netPnl).toBe(-30);
    expect(r.result).toBe("loss");
  });

  it("handles partial exits with three executions", () => {
    const opening = { side: "buy" as const, qty: 3, price: 100, fee: 0, executedAt: T0 };
    const partial = computeTrade(
      input({ executions: [opening, { side: "sell", qty: 1, price: 106, fee: 0, executedAt: T0 + 10 * MIN }] }),
    );
    expect(partial.status).toBe("open");
    expect(partial.result).toBe("open");
    expect(partial.qtyClosed).toBe(1);
    expect(partial.grossPnl).toBe(6);
    expect(partial.closedAt).toBeNull();
    expect(partial.holdMinutes).toBeNull();
    expect(partial.rMultiple).toBeNull();

    const full = computeTrade(
      input({
        executions: [
          opening,
          { side: "sell", qty: 1, price: 106, fee: 0, executedAt: T0 + 10 * MIN },
          { side: "sell", qty: 2, price: 103, fee: 0, executedAt: T0 + 30 * MIN },
        ],
      }),
    );
    expect(full.status).toBe("closed");
    expect(full.exitAvg).toBeCloseTo(104, 10);
    expect(full.grossPnl).toBeCloseTo(12, 10);
    expect(full.closedAt).toBe(T0 + 30 * MIN);
    expect(full.holdMinutes).toBe(30);
  });

  it("averages several entries volume-weighted", () => {
    expect(
      weightedAverage([
        { qty: 1, price: 100 },
        { qty: 3, price: 104 },
      ]),
    ).toBe(103);
    expect(weightedAverage([])).toBeNull();
  });

  it("subtracts execution fees and trade fees and adds swap", () => {
    const r = computeTrade(
      input({
        fees: 1.5,
        swap: -0.5,
        executions: [
          { side: "buy", qty: 1, price: 100, fee: 1, executedAt: T0 },
          { side: "sell", qty: 1, price: 110, fee: 1, executedAt: T0 + MIN },
        ],
      }),
    );
    expect(r.grossPnl).toBe(10);
    expect(r.totalFees).toBe(3.5);
    expect(r.netPnl).toBeCloseTo(6, 10);
  });

  it("uses the manual net P&L and derives gross", () => {
    const r = computeTrade(
      input({
        pnlMode: "manual",
        manualNetPnl: 250,
        fees: 5,
        swap: 2,
        executions: [
          { side: "buy", qty: 1, price: 100, fee: 3, executedAt: T0 },
          { side: "sell", qty: 1, price: 101, fee: 0, executedAt: T0 + MIN },
        ],
      }),
    );
    expect(r.netPnl).toBe(250);
    expect(r.grossPnl).toBe(250 + 8 - 2);
  });

  it("converts quote currency into account currency with the fx rate (fees not converted)", () => {
    const r = computeTrade(
      input({
        multiplier: 100_000,
        fxRate: 0.9,
        fees: 4,
        executions: [
          { side: "buy", qty: 0.5, price: 1.1, fee: 0, executedAt: T0 },
          { side: "sell", qty: 0.5, price: 1.102, fee: 0, executedAt: T0 + MIN },
        ],
      }),
    );
    expect(r.grossPnl).toBeCloseTo(0.002 * 0.5 * 100_000 * 0.9, 8);
    expect(r.netPnl).toBeCloseTo(90 - 4, 8);
  });
});

describe("computeTrade – risk and R", () => {
  it("computes initial risk and R multiple", () => {
    const r = computeTrade(
      input({
        multiplier: 2,
        initialStop: 95,
        executions: [
          { side: "buy", qty: 4, price: 100, fee: 0, executedAt: T0 },
          { side: "sell", qty: 4, price: 110, fee: 0, executedAt: T0 + MIN },
        ],
      }),
    );
    expect(r.initialRisk).toBe(5 * 4 * 2);
    expect(r.rMultiple).toBe(2);
  });

  it("computes R for a short with a stop above entry", () => {
    const r = computeTrade(
      input({
        direction: "short",
        initialStop: 105,
        executions: [
          { side: "sell", qty: 1, price: 100, fee: 0, executedAt: T0 },
          { side: "buy", qty: 1, price: 105, fee: 0, executedAt: T0 + MIN },
        ],
      }),
    );
    expect(r.rMultiple).toBe(-1);
  });

  it("returns no R when there is no stop or the trade is open", () => {
    const noStop = computeTrade(
      input({
        executions: [
          { side: "buy", qty: 1, price: 100, fee: 0, executedAt: T0 },
          { side: "sell", qty: 1, price: 101, fee: 0, executedAt: T0 + MIN },
        ],
      }),
    );
    expect(noStop.initialRisk).toBeNull();
    expect(noStop.rMultiple).toBeNull();
    const open = computeTrade(
      input({ initialStop: 90, executions: [{ side: "buy", qty: 1, price: 100, fee: 0, executedAt: T0 }] }),
    );
    expect(open.initialRisk).toBe(10);
    expect(open.rMultiple).toBeNull();
    expect(open.netPnl).toBeNull();
  });

  it("rejects a stop on the wrong side of the entry", () => {
    const long = input({ initialStop: 101, executions: [{ side: "buy", qty: 1, price: 100, fee: 0, executedAt: T0 }] });
    expect(validateTradeCalc(long)).toEqual([{ field: "initialStop", message: CALC_ERRORS.stopWrongSide }]);
    expect(() => computeTrade(long)).toThrow(TradeCalcError);
    const short = input({
      direction: "short",
      initialStop: 99,
      executions: [{ side: "sell", qty: 1, price: 100, fee: 0, executedAt: T0 }],
    });
    expect(() => computeTrade(short)).toThrow(CALC_ERRORS.stopWrongSide);
  });

  it("rejects closing more than was opened", () => {
    const bad = input({
      executions: [
        { side: "buy", qty: 1, price: 100, fee: 0, executedAt: T0 },
        { side: "sell", qty: 2, price: 101, fee: 0, executedAt: T0 + MIN },
      ],
    });
    expect(() => computeTrade(bad)).toThrow(CALC_ERRORS.qtyClosedExceeds);
  });
});

describe("result classification", () => {
  it("applies the break-even threshold", () => {
    expect(classifyResult(5, "closed", 5)).toBe("be");
    expect(classifyResult(-5, "closed", 5)).toBe("be");
    expect(classifyResult(5.01, "closed", 5)).toBe("win");
    expect(classifyResult(-5.01, "closed", 5)).toBe("loss");
    expect(classifyResult(0, "closed", 0)).toBe("be");
    expect(classifyResult(100, "open", 0)).toBe("open");
  });

  it("classifies through computeTrade with the threshold", () => {
    const r = computeTrade(
      input({
        beThreshold: 2,
        executions: [
          { side: "buy", qty: 1, price: 100, fee: 0, executedAt: T0 },
          { side: "sell", qty: 1, price: 101.5, fee: 0, executedAt: T0 + MIN },
        ],
      }),
    );
    expect(r.result).toBe("be");
  });
});

describe("hold time", () => {
  it("measures from first opening to last closing execution", () => {
    const r = computeTrade(
      input({
        executions: [
          { side: "buy", qty: 1, price: 100, fee: 0, executedAt: T0 + 5 * MIN },
          { side: "buy", qty: 1, price: 99, fee: 0, executedAt: T0 },
          { side: "sell", qty: 2, price: 101, fee: 0, executedAt: T0 + 135 * MIN },
        ],
      }),
    );
    expect(r.holdMinutes).toBe(135);
  });
});

describe("form helpers", () => {
  it("computes planned R:R", () => {
    expect(plannedRiskReward(100, 95, 112)).toBeCloseTo(2.4, 10);
    expect(plannedRiskReward(100, 100, 112)).toBeNull();
  });

  it("suggests a position size rounded down to 2 decimals", () => {
    expect(
      positionSize({ accountBalance: 10_000, riskPercent: 1, entry: 100, stop: 97, multiplier: 1, fxRate: 1 }),
    ).toBe(33.33);
    expect(
      positionSize({ accountBalance: 10_000, riskPercent: 1, entry: 1.1, stop: 1.098, multiplier: 100_000, fxRate: 1 }),
    ).toBe(0.5);
    expect(
      positionSize({ accountBalance: 10_000, riskPercent: 1, entry: 100, stop: 100, multiplier: 1, fxRate: 1 }),
    ).toBe(null);
  });

  it("computes planned risk", () => {
    expect(plannedRisk({ entry: 100, stop: 98, qty: 3, multiplier: 10, fxRate: 2 })).toBe(120);
  });
});
