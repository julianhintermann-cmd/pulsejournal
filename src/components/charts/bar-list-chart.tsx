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

export type BarDatum = { label: string; value: number; tooltip?: { label: string; value: string }[] };

/** Bar chart for grouped statistics (vertical bars, or horizontal with `layout="horizontal"`). */
export function BarListChart({
  data,
  format,
  layout = "vertical",
  height,
}: {
  data: BarDatum[];
  format: (value: number) => string;
  layout?: "vertical" | "horizontal";
  height?: number;
}) {
  const horizontal = layout === "horizontal";
  const h = height ?? (horizontal ? Math.max(120, data.length * 40 + 24) : 220);
  return (
    <div style={{ height: h }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid horizontal={!horizontal} vertical={horizontal} stroke={GRID_STROKE} strokeOpacity={0.6} />
          {horizontal ? (
            <>
              <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={format} />
              <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} width={110} />
              <ReferenceLine x={0} stroke="var(--border)" />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} minTickGap={2} />
              <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={52} tickFormatter={format} />
              <ReferenceLine y={0} stroke="var(--border)" />
            </>
          )}
          <Tooltip
            cursor={{ fill: "var(--surface-2)", opacity: 0.6 }}
            content={({ active, payload }) => {
              const p = active && payload?.[0] ? (payload[0].payload as BarDatum) : null;
              if (!p) return null;
              return <ChartTooltip title={p.label} rows={p.tooltip ?? [{ label: "Wert", value: format(p.value) }]} />;
            }}
          />
          <Bar
            dataKey="value"
            radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            maxBarSize={horizontal ? 22 : 40}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.label} fill={d.value >= 0 ? "var(--profit)" : "var(--loss)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
