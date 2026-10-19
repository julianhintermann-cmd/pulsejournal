import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** iOS inset-grouped list (Settings style): optional section header, rounded group, optional footer. */
export function ListSection({
  header,
  footer,
  children,
  className,
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("ios-section", className)}>
      {header ? <h2 className="ios-section__header">{header}</h2> : null}
      <ul className="ios-group">{children}</ul>
      {footer ? <p className="ios-section__footer">{footer}</p> : null}
    </section>
  );
}

export function InsetGroupedList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-[26px]", className)}>{children}</div>;
}

/** Settings-style icon: white glyph in a 30 px rounded square. */
export function ListIcon({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
  return (
    <span className="ios-row__icon" style={{ backgroundColor: color }}>
      <Icon className="size-[18px] text-white" strokeWidth={2.1} aria-hidden="true" />
    </span>
  );
}

type RowProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  accessory?: React.ReactNode;
  prefetch?: boolean;
  className?: string;
};

/**
 * Inset-grouped row (≥ 44 px): leading icon, title (+ subtitle), trailing value / accessory / chevron. Separators
 * are inset to the text. Press feedback: fill on touch-down, fades out 200 ms after release.
 */
export function ListRow({
  title,
  subtitle,
  value,
  icon,
  href,
  onClick,
  chevron,
  destructive,
  accessory,
  prefetch,
  className,
}: RowProps) {
  const content = (
    <>
      {icon}
      <span className="ios-row__body">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn("truncate", destructive && "text-loss")}>{title}</span>
          {subtitle ? <span className="truncate text-[13px] text-muted-foreground">{subtitle}</span> : null}
        </span>
        {value != null ? <span className="ios-row__value">{value}</span> : null}
        {accessory}
        {(chevron ?? !!href) ? (
          <ChevronRight
            className="size-[18px] shrink-0 text-[var(--ios-label-3)]"
            strokeWidth={2.4}
            aria-hidden="true"
          />
        ) : null}
      </span>
    </>
  );
  const rowClass = cn("ios-row", (href || onClick) && "ios-row--interactive", className);
  return (
    <li>
      {href ? (
        <Link href={href} prefetch={prefetch} className={rowClass}>
          {content}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cn(rowClass, "w-full text-left")}>
          {content}
        </button>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  );
}
