"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AXIS_TICK, ChartTooltip, GRID_STROKE } from "@/components/charts/chart-tooltip";
import { formatR, plural } from "@/lib/format";

/** R distribution; mean and median are marked as reference lines (on a continuous bucket position). */
export function Histogram({
  buckets,
  mean,
  median,
  height = 260,
}: {
  buckets: { label: string; count: number }[];
  mean: number | null;
  median: number | null;
  height?: number;
}) {
  // Bucket centres: ≤−2 → 0 … ≥3 → 6. Map an R value onto that axis for the reference lines.
  const position = (r: number) => Math.max(0, Math.min(6, r <= -2 ? 0 : r >= 3 ? 6 : r + 2.5));
  const data = buckets.map((b, i) => ({ ...b, i }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} strokeOpacity={0.6} />
          <XAxis
            dataKey="i"
            type="number"
            domain={[-0.5, 6.5]}
            ticks={[0, 1, 2, 3, 4, 5, 6]}
            tickFormatter={(i: number) => buckets[i]?.label ?? ""}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            interval={0}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} width={28} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)", opacity: 0.6 }}
            content={({ active, payload }) => {
              const p = active && payload?.[0] ? (payload[0].payload as (typeof data)[number]) : null;
              if (!p) return null;
              return (
                <ChartTooltip
                  title={`${p.label} R`}
                  rows={[{ label: "Anzahl", value: plural(p.count, "Trade", "Trades") }]}
                />
              );
            }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.i <= 2 ? "var(--loss)" : "var(--profit)"} />
            ))}
          </Bar>
          {mean != null ? (
            <ReferenceLine
              x={position(mean)}
              stroke="var(--accent)"
              strokeDasharray="4 4"
              label={{ value: `Ø ${formatR(mean)}`, position: "top", fill: "var(--accent)", fontSize: 11 }}
            />
          ) : null}
          {median != null ? (
            <ReferenceLine
              x={position(median)}
              stroke="var(--text-muted)"
              strokeDasharray="2 3"
              label={{
                value: `Median ${formatR(median)}`,
                position: "insideTopRight",
                fill: "var(--text-muted)",
                fontSize: 11,
              }}
            />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
