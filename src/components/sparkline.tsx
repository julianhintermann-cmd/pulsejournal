import { cn } from "@/lib/utils";

/** Tiny SVG line/area chart. Coloured green when it ends above its start, red when below. */
export function Sparkline({
  values,
  className,
  height = 40,
  tone,
  fill = true,
}: {
  values: number[];
  className?: string;
  height?: number;
  tone?: "profit" | "loss" | "accent" | "neutral";
  fill?: boolean;
}) {
  const width = 120;
  if (values.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className={cn("w-full", className)}
        style={{ height }}
        aria-hidden="true"
      >
        <line
          x1="0"
          x2={width}
          y1={height - 1}
          y2={height - 1}
          stroke="var(--border)"
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const resolved = tone ?? (values[values.length - 1] >= values[0] ? "profit" : "loss");
  const color =
    resolved === "profit"
      ? "var(--profit)"
      : resolved === "loss"
        ? "var(--loss)"
        : resolved === "accent"
          ? "var(--accent)"
          : "var(--text-faint)";
  const gradientId = `spark-${resolved}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full overflow-visible", className)}
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill ? <path d={area} fill={`url(#${gradientId})`} /> : null}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
