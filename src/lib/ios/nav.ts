import { CandlestickChart, Ellipsis, LayoutDashboard, NotebookPen, type LucideIcon } from "lucide-react";

import { isActive, MORE_ITEMS, pageTitle } from "@/components/nav-items";

export type TabKey = "overview" | "trades" | "journal" | "more";
export type Tab = { key: TabKey; href: string; label: string; icon: LucideIcon };

/** The four tabs of the phone layout (section 4.1). */
export const TABS: Tab[] = [
  { key: "overview", href: "/", label: "Übersicht", icon: LayoutDashboard },
  { key: "trades", href: "/trades", label: "Trades", icon: CandlestickChart },
  { key: "journal", href: "/journal", label: "Journal", icon: NotebookPen },
  { key: "more", href: "/more", label: "Mehr", icon: Ellipsis },
];

export function tabFor(pathname: string): TabKey {
  if (pathname === "/") return "overview";
  if (isActive(pathname, "/trades")) return "trades";
  if (isActive(pathname, "/journal")) return "journal";
  return "more";
}

/** Parent screen for the back button; null on tab roots. */
export function parentOf(pathname: string): string | null {
  if (TABS.some((t) => t.href === pathname)) return null;
  const edit = /^\/trades\/([^/]+)\/edit$/.exec(pathname);
  if (edit) return `/trades/${edit[1]}`;
  if (pathname.startsWith("/trades/")) return "/trades";
  if (pathname.startsWith("/journal/")) return "/journal";
  if (/^\/playbooks\/[^/]+$/.test(pathname)) return "/playbooks";
  if (MORE_ITEMS.some((i) => i.href === pathname)) return "/more";
  return "/";
}

/** Depth in the navigation stack (0 = tab root); decides push vs. pop. */
export function depthOf(pathname: string): number {
  let depth = 0;
  for (let p = parentOf(pathname); p; p = parentOf(p)) depth += 1;
  return depth;
}

/** Screens that show a large title (lists and tab roots); detail screens use the inline title only. */
export function hasLargeTitle(pathname: string): boolean {
  if (TABS.some((t) => t.href === pathname)) return true;
  return MORE_ITEMS.some((i) => i.href === pathname);
}

/** Screens presented as a sheet over the previous screen on phones (section 7.3). */
export function isSheetRoute(pathname: string): boolean {
  return pathname === "/trades/new" || /^\/trades\/[^/]+\/edit$/.test(pathname);
}

export function mobileTitle(pathname: string): string {
  if (/^\/journal\/\d{4}-\d{2}-\d{2}$/.test(pathname)) return "Journal";
  return pageTitle(pathname);
}
