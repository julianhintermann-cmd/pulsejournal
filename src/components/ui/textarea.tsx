import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-control border border-border bg-surface-2 px-3 py-2.5 text-base text-foreground transition-[border-color] outline-none placeholder:text-faint md:text-[14px]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-loss",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
