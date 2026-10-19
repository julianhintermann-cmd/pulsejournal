"use client";

import { CalendarDays, NotebookPen, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { useApp } from "@/components/app-context";
import { DirectionChip } from "@/components/direction-chip";
import { NAV_ITEMS } from "@/components/nav-items";
import { PnlValue } from "@/components/pnl-value";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import type { TradeSearchHit } from "@/lib/db/queries";
import { dayKey, formatDate, formatDayKey } from "@/lib/format";
import { searchTrades } from "@/server/actions/trades";

/** Parses `19.10.2026`, `19.10.` (current year), `2026-10-19`, `heute`, `gestern`. */
function parseDateQuery(query: string, timeZone: string): string | null {
  const q = query.trim().toLowerCase();
  const now = Date.now();
  if (q === "heute") return dayKey(now, timeZone);
  if (q === "gestern") return dayKey(now - 86_400_000, timeZone);
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(q);
  if (match) return normalize(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?$/.exec(q);
  if (match) {
    const year = match[3]
      ? match[3].length === 2
        ? 2000 + Number(match[3])
        : Number(match[3])
      : Number(dayKey(now, timeZone).slice(0, 4));
    return normalize(year, Number(match[2]), Number(match[1]));
  }
  return null;
}

function normalize(y: number, m: number, d: number) {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { timeZone } = useApp();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TradeSearchHit[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        setHits(await searchTrades(q));
      });
    }, 150);
    return () => window.clearTimeout(handle);
  }, [query]);

  const dateKey = useMemo(() => parseDateQuery(query, timeZone), [query, timeZone]);
  const visibleHits = query.trim().length >= 2 ? hits : [];

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
      showCloseButton={false}
    >
      <CommandInput value={query} onValueChange={setQuery} placeholder="Seite, Symbol, Notiz oder Datum suchen…" />
      <CommandList className="max-h-[min(420px,60dvh)]">
        <CommandEmpty>Keine Treffer.</CommandEmpty>
        {dateKey ? (
          <CommandGroup heading="Journal">
            <CommandItem value={`journal ${query}`} onSelect={() => go(`/journal/${dateKey}`)}>
              <CalendarDays />
              Journal öffnen: {formatDayKey(dateKey)}
            </CommandItem>
          </CommandGroup>
        ) : null}
        {visibleHits.length > 0 ? (
          <CommandGroup heading="Trades">
            {visibleHits.map((t) => (
              <CommandItem
                key={t.id}
                value={`trade ${t.id} ${t.symbol} ${query}`}
                onSelect={() => go(`/trades/${t.id}`)}
              >
                <span className="font-medium">{t.symbol}</span>
                <DirectionChip direction={t.direction} size="sm" />
                <span className="text-small text-muted-foreground">{formatDate(t.openedAt, timeZone)}</span>
                <span className="ml-auto">
                  {t.netPnl != null ? <PnlValue value={t.netPnl} currency={t.currency} className="text-small" /> : null}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandGroup heading="Aktionen">
          <CommandItem value="Neuer Trade erfassen" onSelect={() => go("/trades/new")}>
            <Plus />
            Neuer Trade
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem value="Journal heute öffnen" onSelect={() => go("/journal/today")}>
            <NotebookPen />
            Journal heute
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Seiten">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} value={`Seite ${item.label}`} onSelect={() => go(item.href)}>
              <item.icon />
              {item.label}
              {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
