import { useId } from "react";

import { cn } from "@/lib/utils";

/** Pulse Journal logo mark (same geometry as src/assets/logo.svg). */
export function Logo({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4F7CFF" />
          <stop offset="1" stopColor="#22C3E6" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" ry="22" fill={`url(#${id})`} />
      <polyline
        points="14,56 34,56 42,34 54,72 62,46 68,56 86,56"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
