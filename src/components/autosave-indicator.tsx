import { Check, CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

import { Spinner } from "@/components/spinner";

export type AutosaveState = "idle" | "pending" | "saving" | "saved" | "error";

export function AutosaveIndicator({ state, className }: { state: AutosaveState; className?: string }) {
  if (state === "idle") return null;
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium",
        state === "error"
          ? "bg-loss-soft text-loss"
          : state === "saved"
            ? "bg-profit-soft text-profit"
            : "bg-surface-2 text-muted-foreground",
        className,
      )}
    >
      {state === "saving" ? <Spinner className="size-3" /> : null}
      {state === "saved" ? <Check className="size-3" strokeWidth={3} /> : null}
      {state === "error" ? <CircleAlert className="size-3" /> : null}
      {state === "pending"
        ? "Ungespeichert"
        : state === "saving"
          ? "Speichert…"
          : state === "saved"
            ? "Gespeichert ✓"
            : "Nicht gespeichert"}
    </span>
  );
}
