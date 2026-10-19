"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AXIS_TICK, ChartTooltip, GRID_STROKE } from "@/components/charts/chart-tooltip";
import { formatDate, formatDateTime, formatMoney, formatMoneyCompact } from "@/lib/format";

export type EquityDatum = { ts: number; balance: number; tradePnl: number | null };

/** Balance curve with gradient fill; green when the period ends above its start, red when below. */
export function EquityChart({
  data,
  currency,
  timeZone,
  height = 260,
}: {
  data: EquityDatum[];
  currency: string;
  timeZone: string;
  height?: number;
}) {
  const id = useId().replace(/:/g, "");
  const up = data.length < 2 || data[data.length - 1].balance >= data[0].balance;
  const color = up ? "var(--profit)" : "var(--loss)";
  const points = data.map((d, i) => ({ ...d, i }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={`eq-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
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
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => formatMoneyCompact(v)}
          />
          <Tooltip
            cursor={{ stroke: "var(--text-faint)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = active && payload?.[0] ? (payload[0].payload as EquityDatum) : null;
              if (!p) return null;
              return (
                <ChartTooltip
                  title={formatDateTime(p.ts, timeZone)}
                  rows={[
                    { label: "Kontostand", value: formatMoney(p.balance, currency) },
                    ...(p.tradePnl != null
                      ? [{ label: "Trade P&L", value: formatMoney(p.tradePnl, currency, { signed: true }) }]
                      : []),
                  ]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={color}
            strokeWidth={2}
            fill={`url(#eq-${id})`}
            isAnimationActive={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
