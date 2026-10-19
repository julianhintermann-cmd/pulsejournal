"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/** Collapsible card used for the sections of the detailed trade form. */
export function SectionCard({
  title,
  aside,
  defaultOpen = true,
  children,
  className,
}: {
  title: string;
  aside?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn("card overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left md:px-5"
      >
        <h2 className="flex-1 text-h3">{title}</h2>
        {aside ? <span className="text-small text-muted-foreground">{aside}</span> : null}
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {open ? <div className="border-t border-border px-4 pt-4 pb-5 md:px-5">{children}</div> : null}
    </section>
  );
}
