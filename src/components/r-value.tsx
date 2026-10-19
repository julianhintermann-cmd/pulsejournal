import { formatR } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RValue({
  value,
  className,
  muted,
}: {
  value: number | null | undefined;
  className?: string;
  muted?: boolean;
}) {
  const rounded = value == null ? null : Math.round(value * 100) / 100;
  const tone =
    muted || rounded == null || rounded === 0 ? "text-muted-foreground" : rounded > 0 ? "text-profit" : "text-loss";
  return <span className={cn("tabular-nums whitespace-nowrap", tone, className)}>{formatR(value)}</span>;
}
