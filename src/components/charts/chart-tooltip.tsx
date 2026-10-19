import { cn } from "@/lib/utils";

/** Shared tooltip panel for all charts. */
export function ChartTooltip({
  title,
  rows,
  className,
}: {
  title: string;
  rows: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-40 rounded-[12px] border border-border bg-surface-2 px-3 py-2 text-small shadow-overlay",
        className,
      )}
    >
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4 text-muted-foreground">
          <span>{row.label}</span>
          <span className="font-semibold text-foreground tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export const AXIS_TICK = { fill: "var(--text-faint)", fontSize: 11 };
export const GRID_STROKE = "var(--border)";
