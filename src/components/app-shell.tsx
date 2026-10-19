"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

import { BottomTabBar } from "@/components/bottom-tab-bar";
import { CommandMenu } from "@/components/command-menu";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SidebarNav } from "@/components/sidebar-nav";
import { TopBar } from "@/components/top-bar";
import { cn } from "@/lib/utils";

export const SIDEBAR_COOKIE = "pulse_sidebar";

export function AppShell({ initialCollapsed, children }: { initialCollapsed: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [commandOpen, setCommandOpen] = useState(false);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      return next;
    });
  };
  const openCommand = useCallback(() => setCommandOpen(true), []);

  return (
    <div className="min-h-dvh">
      <SidebarNav collapsed={collapsed} onToggle={toggle} />
      <div className={cn("flex min-h-dvh flex-col md:pl-[72px]", !collapsed && "lg:pl-[248px]")}>
        <TopBar onOpenCommand={openCommand} />
        <motion.main
          key={pathname}
          id="main"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex-1 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+96px)] md:px-8 md:pt-6 md:pb-10"
        >
          {children}
        </motion.main>
      </div>
      <BottomTabBar />
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
      <KeyboardShortcuts onOpenCommand={openCommand} />
    </div>
  );
}
