import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Money value coloured by sign with a `+` prefix for gains. */
export function PnlValue({
  value,
  currency,
  className,
  neutral,
}: {
  value: number | null | undefined;
  currency: string;
  className?: string;
  /** Render without colour (e.g. balances). */
  neutral?: boolean;
}) {
  const rounded = value == null ? null : Math.round(value * 100) / 100;
  const tone = neutral || rounded == null || rounded === 0 ? "" : rounded > 0 ? "text-profit" : "text-loss";
  return (
    <span className={cn("tabular-nums whitespace-nowrap", tone, className)}>
      {formatMoney(value, currency, { signed: !neutral })}
    </span>
  );
}
