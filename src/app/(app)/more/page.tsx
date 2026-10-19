import { ChevronRight, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { InsetGroupedList, ListIcon, ListRow, ListSection } from "@/components/ios/list";
import { MORE_ITEMS } from "@/components/nav-items";
import { logout } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Mehr" };

/** Settings-style icon colours for the phone list (section 6). */
const ICON_COLORS: Record<string, string> = {
  "/calendar": "#FF3B30",
  "/stats": "#0A84FF",
  "/playbooks": "#FF9500",
  "/accounts": "#34C759",
  "/import-export": "#8E8E93",
  "/settings": "#8E8E93",
};

export default function MorePage() {
  return (
    <>
      {/* Phones: iOS inset-grouped list like the Settings app. */}
      <InsetGroupedList className="md:hidden">
        <ListSection>
          {MORE_ITEMS.map((item) => (
            <ListRow
              key={item.href}
              href={item.href}
              title={item.label}
              icon={<ListIcon icon={item.icon} color={ICON_COLORS[item.href] ?? "#8E8E93"} />}
            />
          ))}
        </ListSection>
        <form action={logout} className="ios-group">
          <button type="submit" className="ios-row ios-row--interactive w-full text-left">
            <ListIcon icon={LogOut} color="#FF3B30" />
            <span className="ios-row__body text-loss">Abmelden</span>
          </button>
        </form>
      </InsetGroupedList>
      <MoreCards />
    </>
  );
}

/** Tablet and desktop. */
function MoreCards() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 max-md:hidden">
      <nav className="card overflow-hidden" aria-label="Weitere Seiten">
        <ul className="divide-y divide-border">
          {MORE_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex h-14 items-center gap-3 px-4 text-[15px] font-medium transition-colors active:bg-surface-2"
              >
                <span className="flex size-8 items-center justify-center rounded-[9px] bg-surface-2">
                  <item.icon className="size-[18px] text-muted-foreground" />
                </span>
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="size-4 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form action={logout} className="card overflow-hidden">
        <button
          type="submit"
          className="flex h-14 w-full items-center gap-3 px-4 text-[15px] font-medium text-loss transition-colors active:bg-surface-2"
        >
          <span className="flex size-8 items-center justify-center rounded-[9px] bg-loss-soft">
            <LogOut className="size-[18px]" />
          </span>
          Abmelden
        </button>
      </form>
    </div>
  );
}
