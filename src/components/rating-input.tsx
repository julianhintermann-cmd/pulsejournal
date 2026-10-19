"use client";

import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/** 1–5 rating (stars or numbered pills). Clicking the current value clears it. */
export function RatingInput({
  value,
  onChange,
  label,
  variant = "stars",
  readOnly,
}: {
  value: number | null;
  onChange?: (value: number | null) => void;
  label: string;
  variant?: "stars" | "numbers";
  readOnly?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value != null && n <= value;
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${n} von 5`}
            disabled={readOnly}
            onClick={() => onChange?.(selected ? null : n)}
            className={cn(
              "inline-flex items-center justify-center transition-colors disabled:cursor-default",
              variant === "stars"
                ? "size-9 rounded-full md:size-8"
                : "h-9 min-w-9 rounded-full px-2 text-[13px] font-semibold md:h-8 md:min-w-8",
              variant === "numbers" &&
                (selected ? "bg-accent text-white" : "bg-surface-2 text-muted-foreground hover:text-foreground"),
            )}
          >
            {variant === "stars" ? (
              <Star className={cn("size-5", active ? "fill-be text-be" : "text-faint")} strokeWidth={1.75} />
            ) : (
              n
            )}
          </button>
        );
      })}
    </div>
  );
}
