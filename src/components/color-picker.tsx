"use client";

import { Check } from "lucide-react";

import { PALETTE } from "@/lib/validation";
import { cn } from "@/lib/utils";

export function ColorPicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (color: string) => void;
  id?: string;
}) {
  return (
    <div id={id} role="radiogroup" aria-label="Farbe" className="flex flex-wrap gap-2">
      {PALETTE.map((color) => {
        const selected = value.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            onClick={() => onChange(color)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full transition-transform active:scale-95",
              selected && "ring-2 ring-foreground ring-offset-2 ring-offset-surface",
            )}
            style={{ backgroundColor: color }}
          >
            {selected ? <Check className="size-4 text-white" strokeWidth={3} /> : null}
          </button>
        );
      })}
    </div>
  );
}
