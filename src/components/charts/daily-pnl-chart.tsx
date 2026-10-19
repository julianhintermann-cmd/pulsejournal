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
import { formatDayKey, formatMoney, formatMoneyCompact, plural } from "@/lib/format";

/** Green/red bars of net P&L per trading day. */
export function DailyPnlChart({
  data,
  currency,
  height = 200,
}: {
  data: { day: string; netPnl: number; trades: number }[];
  currency: string;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} strokeOpacity={0.6} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            minTickGap={24}
            tickFormatter={(d: string) => formatDayKey(d, "dd.MM.")}
          />
          <YAxis
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            width={56}
            tickFormatter={(v: number) => formatMoneyCompact(v)}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Tooltip
            cursor={{ fill: "var(--surface-2)", opacity: 0.6 }}
            content={({ active, payload }) => {
              const p = active && payload?.[0] ? (payload[0].payload as (typeof data)[number]) : null;
              if (!p) return null;
              return (
                <ChartTooltip
                  title={formatDayKey(p.day, "EEEE, d. MMMM")}
                  rows={[
                    { label: "Netto P&L", value: formatMoney(p.netPnl, currency, { signed: true }) },
                    { label: "Trades", value: plural(p.trades, "Trade", "Trades") },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="netPnl" radius={[4, 4, 4, 4]} maxBarSize={28} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.day} fill={d.netPnl >= 0 ? "var(--profit)" : "var(--loss)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
