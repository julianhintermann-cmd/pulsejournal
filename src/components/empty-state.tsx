import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Line-art icon + title + one sentence + one primary action (section 9.4). */
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  illustration?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      {illustration ?? (Icon ? <Icon className="size-10 text-faint" strokeWidth={1.5} aria-hidden="true" /> : null)}
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-h3">{title}</h2>
        <p className="text-body text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

/** Three stacked line-art candles in the accent colour (dashboard empty state). */
export function CandlesIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden="true" className={cn("h-24 w-30 text-accent", className)}>
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="30" y1="22" x2="30" y2="34" />
        <rect x="22" y="34" width="16" height="30" rx="3" />
        <line x1="30" y1="64" x2="30" y2="78" />
        <line x1="60" y1="8" x2="60" y2="20" opacity="0.85" />
        <rect x="52" y="20" width="16" height="40" rx="3" opacity="0.85" />
        <line x1="60" y1="60" x2="60" y2="70" opacity="0.85" />
        <line x1="90" y1="28" x2="90" y2="42" opacity="0.6" />
        <rect x="82" y="42" width="16" height="24" rx="3" opacity="0.6" />
        <line x1="90" y1="66" x2="90" y2="88" opacity="0.6" />
      </g>
    </svg>
  );
}
