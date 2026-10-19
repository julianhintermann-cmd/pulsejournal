import {
  ArrowLeftRight,
  BookMarked,
  CalendarDays,
  CandlestickChart,
  ChartColumn,
  LayoutDashboard,
  NotebookPen,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; shortcut?: string };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Übersicht", icon: LayoutDashboard, shortcut: "G D" },
  { href: "/trades", label: "Trades", icon: CandlestickChart, shortcut: "G T" },
  { href: "/calendar", label: "Kalender", icon: CalendarDays, shortcut: "G C" },
  { href: "/journal", label: "Journal", icon: NotebookPen, shortcut: "G J" },
  { href: "/stats", label: "Statistiken", icon: ChartColumn, shortcut: "G S" },
  { href: "/playbooks", label: "Playbooks", icon: BookMarked },
  { href: "/accounts", label: "Konten", icon: Wallet },
  { href: "/import-export", label: "Import/Export", icon: ArrowLeftRight },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

/** Pages listed on the mobile "Mehr" page (everything not in the bottom tab bar). */
export const MORE_ITEMS = NAV_ITEMS.filter((item) => !["/", "/trades", "/journal"].includes(item.href));

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Title shown in the top bar for a pathname. */
export function pageTitle(pathname: string) {
  if (pathname === "/trades/new") return "Neuer Trade";
  if (/^\/trades\/[^/]+\/edit$/.test(pathname)) return "Trade bearbeiten";
  if (/^\/trades\/[^/]+$/.test(pathname)) return "Trade";
  if (/^\/playbooks\/[^/]+$/.test(pathname)) return "Playbook";
  if (pathname === "/more") return "Mehr";
  const item = [...NAV_ITEMS].reverse().find((i) => isActive(pathname, i.href));
  return item?.label ?? "Pulse Journal";
}

/** Which pages show the global filter, and in which mode. */
export function filterMode(pathname: string): "full" | "account" | null {
  if (pathname === "/" || pathname === "/trades" || pathname === "/stats") return "full";
  if (pathname === "/playbooks" || /^\/playbooks\/[^/]+$/.test(pathname)) return "full";
  if (pathname === "/calendar") return "account";
  return null;
}
