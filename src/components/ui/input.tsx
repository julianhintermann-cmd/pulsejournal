import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      // Number fields show "next" on the phone keyboard so forms can be filled field by field.
      enterKeyHint={props.enterKeyHint ?? (props.inputMode === "decimal" ? "next" : undefined)}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-control border border-border bg-surface-2 px-3 text-base text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-faint md:h-10 md:text-[14px]",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-loss",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
