"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AXIS_TICK, ChartTooltip, GRID_STROKE } from "@/components/charts/chart-tooltip";
import { formatDate, formatDateTime, formatMoney, formatMoneyCompact, formatPercent } from "@/lib/format";

/** Underwater chart: distance below the running balance peak. */
export function DrawdownChart({
  data,
  currency,
  timeZone,
  height = 180,
}: {
  data: { ts: number; drawdown: number; percent: number }[];
  currency: string;
  timeZone: string;
  height?: number;
}) {
  const id = useId().replace(/:/g, "");
  const points = data.map((d, i) => ({ ...d, i }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={`dd-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--loss)" stopOpacity={0} />
              <stop offset="100%" stopColor="var(--loss)" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} strokeOpacity={0.6} />
          <XAxis
            dataKey="i"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            minTickGap={40}
            tickFormatter={(i: number) => (points[i] ? formatDate(points[i].ts, timeZone).slice(0, 5) : "")}
          />
          <YAxis
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            width={56}
            tickFormatter={(v: number) => formatMoneyCompact(v)}
          />
          <Tooltip
            cursor={{ stroke: "var(--text-faint)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = active && payload?.[0] ? (payload[0].payload as (typeof points)[number]) : null;
              if (!p) return null;
              return (
                <ChartTooltip
                  title={formatDateTime(p.ts, timeZone)}
                  rows={[
                    { label: "Drawdown", value: formatMoney(p.drawdown, currency) },
                    { label: "vom Hoch", value: formatPercent(p.percent) },
                  ]}
                />
              );
            }}
          />
          <Area
            type="stepAfter"
            dataKey="drawdown"
            stroke="var(--loss)"
            strokeWidth={1.5}
            fill={`url(#dd-${id})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
