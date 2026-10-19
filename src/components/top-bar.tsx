"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { GlobalFilterBar, GlobalFilterSheetButton } from "@/components/global-filter";
import { filterMode, pageTitle } from "@/components/nav-items";
import { Button } from "@/components/ui/button";

export function TopBar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const pathname = usePathname();
  const title = pageTitle(pathname);
  const mode = filterMode(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-[20px]">
      <div className="flex h-14 items-center gap-2 px-4 md:h-16 md:gap-3 md:px-8">
        <h1 className="min-w-0 flex-1 truncate text-h2 md:text-h1">{title}</h1>

        {/* Mobile actions */}
        <div className="flex items-center md:hidden">
          <Button variant="ghost" size="icon" aria-label="Suchen" onClick={onOpenCommand}>
            <Search className="size-5" />
          </Button>
          {mode ? (
            <Suspense>
              <GlobalFilterSheetButton mode={mode} />
            </Suspense>
          ) : null}
        </div>

        {/* Desktop / tablet actions */}
        <div className="hidden items-center gap-2 md:flex">
          {mode ? (
            <Suspense>
              <GlobalFilterBar mode={mode} />
            </Suspense>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenCommand}
            className="gap-2 font-normal text-muted-foreground"
            aria-label="Befehlspalette öffnen"
          >
            <Search />
            <span className="hidden xl:inline">Suchen</span>
            <kbd className="rounded-[5px] border border-border bg-surface-2 px-1.5 font-sans text-[11px] text-faint">
              ⌘K
            </kbd>
          </Button>
          <Button asChild size="sm">
            <Link href="/trades/new">
              <Plus />
              Neuer Trade
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
