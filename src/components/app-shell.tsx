"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { BottomTabBar } from "@/components/bottom-tab-bar";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SidebarNav } from "@/components/sidebar-nav";
import { RouteSkeleton } from "@/components/skeletons";
import { TopBar } from "@/components/top-bar";
import { cn } from "@/lib/utils";

// The command palette (cmdk) is only loaded once it is opened for the first time.
const CommandMenu = dynamic(() => import("@/components/command-menu").then((m) => m.CommandMenu), { ssr: false });

export const SIDEBAR_COOKIE = "pulse_sidebar";

export function AppShell({ initialCollapsed, children }: { initialCollapsed: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandLoaded, setCommandLoaded] = useState(false);
  // The entrance transition only plays for client-side navigations, never on the initial load (LCP).
  const [initialPath] = useState(pathname);
  const [navigated, setNavigated] = useState(false);
  if (!navigated && pathname !== initialPath) setNavigated(true);

  // Skeleton for slow client-side navigations: shown only if the next page takes longer than 150 ms, so the
  // initial load and fast navigations always render the real content directly.
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [renderedPath, setRenderedPath] = useState(pathname);
  const pendingTimer = useRef<number | null>(null);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setPendingPath(null);
  }
  useEffect(() => {
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
  }, [pathname]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === window.location.pathname) return;
      if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
      pendingTimer.current = window.setTimeout(() => setPendingPath(url.pathname), 150);
      // Safety net: never keep a skeleton when a navigation was cancelled.
      window.setTimeout(() => setPendingPath((p) => (p === url.pathname ? null : p)), 10_000);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      return next;
    });
  };
  const openCommand = useCallback(() => {
    setCommandLoaded(true);
    setCommandOpen(true);
  }, []);

  return (
    <div className="min-h-dvh">
      <SidebarNav collapsed={collapsed} onToggle={toggle} />
      <div className={cn("flex min-h-dvh flex-col md:pl-[72px]", !collapsed && "lg:pl-[248px]")}>
        <TopBar onOpenCommand={openCommand} />
        <main
          key={pathname}
          id="main"
          className={cn(
            "flex-1 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+96px)] md:px-8 md:pt-6 md:pb-10",
            navigated && "animate-page",
          )}
        >
          {pendingPath ? <RouteSkeleton pathname={pendingPath} /> : children}
        </main>
      </div>
      <BottomTabBar />
      {commandLoaded ? <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} /> : null}
      <KeyboardShortcuts onOpenCommand={openCommand} />
    </div>
  );
}
