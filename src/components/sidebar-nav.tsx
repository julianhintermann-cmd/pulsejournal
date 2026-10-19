"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useApp } from "@/components/app-context";
import { Logo } from "@/components/logo";
import { isActive, NAV_ITEMS } from "@/components/nav-items";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { logout } from "@/server/actions/auth";

function NavTooltip({ label, enabled, children }: { label: string; enabled: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {/* On tablets the rail is always collapsed; on desktop only when the user collapsed it. */}
      <TooltipContent side="right" className={cn(enabled ? "" : "lg:hidden")}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Desktop sidebar (248 px, collapsible to a 72 px icon rail) and tablet rail (always 72 px).
 * Labels are shown only at ≥ 1024 px when expanded.
 */
export function SidebarNav({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { username } = useApp();
  const labelClass = cn("hidden truncate", !collapsed && "lg:inline");

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-border bg-surface pt-[env(safe-area-inset-top)] transition-[width] duration-200 ease-pulse md:flex",
        !collapsed && "lg:w-[248px]",
      )}
    >
      <div className={cn("flex h-16 items-center gap-3 px-5", !collapsed && "lg:px-5")}>
        <Link href="/" aria-label="Pulse Journal" className="flex min-w-0 items-center gap-3 rounded-[8px]">
          <Logo className="size-8" />
          <span className={cn(labelClass, "text-h3")}>Pulse Journal</span>
        </Link>
      </div>

      <nav aria-label="Hauptnavigation" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <NavTooltip key={item.href} label={item.label} enabled={collapsed}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-10 items-center gap-3 rounded-control px-3 text-[14px] font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-foreground"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-[18px] shrink-0", active && "text-accent")} />
                <span className={labelClass}>{item.label}</span>
              </Link>
            </NavTooltip>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-border p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <button
          type="button"
          onClick={onToggle}
          className="hidden h-10 items-center gap-3 rounded-control px-3 text-[14px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground lg:flex"
          aria-label={collapsed ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-[18px] shrink-0" />
          ) : (
            <PanelLeftClose className="size-[18px] shrink-0" />
          )}
          <span className={labelClass}>Einklappen</span>
        </button>
        <div className="flex items-center gap-3 rounded-control px-3 py-2">
          <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-semibold uppercase">
            {username.slice(0, 1)}
          </span>
          <span className={cn(labelClass, "min-w-0 flex-1 text-[14px] font-medium")}>{username}</span>
        </div>
        <form action={logout}>
          <NavTooltip label="Abmelden" enabled={collapsed}>
            <button
              type="submit"
              className="flex h-10 w-full items-center gap-3 rounded-control px-3 text-[14px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <LogOut className="size-[18px] shrink-0" />
              <span className={labelClass}>Abmelden</span>
            </button>
          </NavTooltip>
        </form>
      </div>
    </aside>
  );
}
