"use client";

import { CandlestickChart, Ellipsis, LayoutDashboard, NotebookPen, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActive, MORE_ITEMS } from "@/components/nav-items";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Übersicht", icon: LayoutDashboard },
  { href: "/trades", label: "Trades", icon: CandlestickChart },
  { href: "/journal", label: "Journal", icon: NotebookPen },
  { href: "/more", label: "Mehr", icon: Ellipsis },
];

function Tab({ href, label, icon: Icon, active }: (typeof TABS)[number] & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
        active ? "text-foreground" : "text-faint",
      )}
    >
      <Icon className={cn("size-[22px]", active && "text-accent")} strokeWidth={active ? 2.2 : 1.9} />
      {label}
    </Link>
  );
}

/** Mobile bottom tab bar with the raised "+" button (section 9.5). */
export function BottomTabBar() {
  const pathname = usePathname();
  const moreActive = pathname === "/more" || MORE_ITEMS.some((i) => isActive(pathname, i.href));
  const [overview, trades, journal, more] = TABS;
  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-[20px] md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch px-2">
        <Tab {...overview} active={isActive(pathname, "/")} />
        <Tab {...trades} active={isActive(pathname, "/trades") && pathname !== "/trades/new"} />
        <div className="flex flex-1 items-start justify-center">
          <Link
            href="/trades/new?mode=quick"
            aria-label="Neuer Trade"
            className="-mt-3 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_24px_rgba(79,124,255,0.45)] transition-transform active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.4} />
          </Link>
        </div>
        <Tab {...journal} active={isActive(pathname, "/journal")} />
        <Tab {...more} active={moreActive} />
      </div>
    </nav>
  );
}
