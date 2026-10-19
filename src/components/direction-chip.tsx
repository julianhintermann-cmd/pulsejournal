import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import type { Direction } from "@/lib/db/schema";
import { DIRECTION_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function DirectionChip({
  direction,
  size = "md",
  className,
}: {
  direction: Direction;
  size?: "sm" | "md";
  className?: string;
}) {
  const long = direction === "long";
  const Icon = long ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full font-semibold",
        size === "sm" ? "h-5 pr-2 pl-1.5 text-[11px]" : "h-6 pr-2.5 pl-2 text-[12px]",
        long ? "bg-profit-soft text-profit" : "bg-loss-soft text-loss",
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={2.5} />
      {DIRECTION_LABELS[direction]}
    </span>
  );
}
