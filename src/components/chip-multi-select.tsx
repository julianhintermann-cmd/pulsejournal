"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type ChipOption = { value: string; label: string; color?: string };

/** Toggleable chips; `single` turns it into a single-choice group (click again to clear). */
export function ChipMultiSelect({
  options,
  value,
  onChange,
  single,
  label,
  tone = "accent",
}: {
  options: ChipOption[];
  value: string[];
  onChange: (value: string[]) => void;
  single?: boolean;
  label: string;
  tone?: "accent" | "loss";
}) {
  const toggle = (v: string) => {
    if (single) onChange(value.includes(v) ? [] : [v]);
    else onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(o.value)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors md:h-8",
              active
                ? tone === "loss"
                  ? "border-transparent bg-loss-soft text-loss"
                  : "border-transparent bg-accent-soft text-accent"
                : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
            )}
          >
            {o.color ? <span className="size-2 rounded-full" style={{ backgroundColor: o.color }} /> : null}
            {active && !o.color ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
