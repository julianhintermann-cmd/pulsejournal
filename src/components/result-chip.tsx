import type { TradeResult } from "@/lib/db/schema";
import { RESULT_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const TONES: Record<TradeResult, string> = {
  win: "bg-profit-soft text-profit",
  loss: "bg-loss-soft text-loss",
  be: "bg-be-soft text-be",
  open: "bg-accent-soft text-accent",
};

export function ResultChip({
  result,
  size = "md",
  className,
}: {
  result: TradeResult;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-semibold",
        size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-2.5 text-[12px]",
        TONES[result],
        className,
      )}
    >
      {RESULT_LABELS[result]}
    </span>
  );
}
