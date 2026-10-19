"use client";

import type { RowSelectionState } from "@tanstack/react-table";
import { CandlestickChart, Filter, Plus, Search, Tag, Trash2, X, BookMarked } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-context";
import { ChipMultiSelect } from "@/components/chip-multi-select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { FOCUS_SEARCH_EVENT } from "@/components/keyboard-shortcuts";
import { PnlValue } from "@/components/pnl-value";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { RValue } from "@/components/r-value";
import { Spinner } from "@/components/spinner";
import { TagInput } from "@/components/tag-input";
import { TradeCard } from "@/components/trades/trade-card";
import { TradeListRow } from "@/components/trades/trade-list-row";
import { TradesTable } from "@/components/trades/trades-table";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { TradeRow } from "@/lib/db/queries";
import { dayKey, formatDayKey, formatPercent, plural } from "@/lib/format";
import { RESULT_LABELS } from "@/lib/labels";
import { SESSION_LABELS, SESSION_ORDER } from "@/lib/sessions";
import { winRate } from "@/lib/stats/metrics";
import {
  applyTradeFilters,
  countActiveFilters,
  EMPTY_TRADE_FILTERS,
  parseTradeFilters,
  writeTradeFilters,
  type TradeListFilters,
} from "@/lib/trade-filters";
import { cn } from "@/lib/utils";
import { bulkUpdateTrades, deleteTrades } from "@/server/actions/trades";

type Options = {
  symbols: string[];
  playbooks: { id: string; name: string; color: string }[];
  tags: { id: string; name: string; color: string }[];
  mistakes: { id: string; name: string }[];
};

function sumByCurrency(rows: TradeRow[]) {
  const map = new Map<string, number>();
  for (const r of rows)
    if (r.netPnl != null && r.status === "closed") map.set(r.currency, (map.get(r.currency) ?? 0) + r.netPnl);
  return [...map.entries()];
}

function Summary({ rows }: { rows: TradeRow[] }) {
  const closed = rows.filter((r) => r.status === "closed");
  const rate = winRate(closed);
  const totalR = closed.reduce((a, r) => a + (r.rMultiple ?? 0), 0);
  const sums = sumByCurrency(rows);
  return (
    <div className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 md:px-5">
      <div className="flex flex-col">
        <span className="text-small text-muted-foreground">Trades</span>
        <span className="text-h3 tabular-nums">{rows.length}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-small text-muted-foreground">Netto P&L</span>
        {sums.length === 0 ? (
          <span className="text-h3 text-muted-foreground">–</span>
        ) : (
          sums.map(([currency, value]) => (
            <PnlValue key={currency} value={value} currency={currency} className="text-h3" />
          ))
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-small text-muted-foreground">Win Rate</span>
        <span className="text-h3 tabular-nums">{formatPercent(rate)}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-small text-muted-foreground">Total R</span>
        <RValue value={totalR} className="text-h3" />
      </div>
    </div>
  );
}

function FilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: TradeListFilters;
  onApply: (f: TradeListFilters) => void;
  options: Options;
}) {
  const [draft, setDraft] = useState(filters);
  const handleOpen = (next: boolean) => {
    if (next) setDraft(filters);
    onOpenChange(next);
  };
  // Sync draft whenever the sheet is (re)opened from outside.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setDraft(filters);
  }

  const section = (title: string, children: React.ReactNode) => (
    <section className="flex flex-col gap-2">
      <h3 className="text-small tracking-[0.04em] text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpen}
      title="Trades filtern"
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => setDraft({ ...EMPTY_TRADE_FILTERS, q: draft.q })}>
            Filter zurücksetzen
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Anwenden
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-1">
        {section(
          "Ergebnis",
          <ChipMultiSelect
            label="Ergebnis"
            options={(["win", "loss", "be", "open"] as const).map((r) => ({ value: r, label: RESULT_LABELS[r] }))}
            value={draft.results}
            onChange={(results) => setDraft((d) => ({ ...d, results }))}
          />,
        )}
        {section(
          "Richtung",
          <ChipMultiSelect
            label="Richtung"
            single
            options={[
              { value: "long", label: "Long" },
              { value: "short", label: "Short" },
            ]}
            value={draft.direction ? [draft.direction] : []}
            onChange={(v) => setDraft((d) => ({ ...d, direction: (v[0] as "long" | "short") ?? null }))}
          />,
        )}
        {options.symbols.length > 0
          ? section(
              "Symbol",
              <ChipMultiSelect
                label="Symbol"
                options={options.symbols.map((s) => ({ value: s, label: s }))}
                value={draft.symbols}
                onChange={(symbols) => setDraft((d) => ({ ...d, symbols }))}
              />,
            )
          : null}
        {section(
          "Setup",
          <ChipMultiSelect
            label="Setup"
            options={[
              ...options.playbooks.map((p) => ({ value: p.id, label: p.name, color: p.color })),
              { value: "none", label: "Ohne Setup" },
            ]}
            value={draft.setups}
            onChange={(setups) => setDraft((d) => ({ ...d, setups }))}
          />,
        )}
        {section(
          "Session",
          <ChipMultiSelect
            label="Session"
            options={SESSION_ORDER.map((s) => ({ value: s, label: SESSION_LABELS[s] }))}
            value={draft.sessions}
            onChange={(sessions) => setDraft((d) => ({ ...d, sessions }))}
          />,
        )}
        {options.tags.length > 0
          ? section(
              "Tags",
              <ChipMultiSelect
                label="Tags"
                options={options.tags.map((t) => ({ value: t.id, label: t.name, color: t.color }))}
                value={draft.tags}
                onChange={(tags) => setDraft((d) => ({ ...d, tags }))}
              />,
            )
          : null}
        {section(
          "Fehler",
          <ChipMultiSelect
            label="Fehler"
            tone="loss"
            options={options.mistakes.map((m) => ({ value: m.id, label: m.name }))}
            value={draft.mistakes}
            onChange={(mistakes) => setDraft((d) => ({ ...d, mistakes }))}
          />,
        )}
      </div>
    </ResponsiveDialog>
  );
}

export function TradesView({ rows, options, compact }: { rows: TradeRow[]; options: Options; compact: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { timeZone } = useApp();
  const filters = useMemo(() => parseTradeFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  const [query, setQuery] = useState(filters.q);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [bulk, setBulk] = useState<"tags" | "setup" | "delete" | null>(null);
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [bulkSetup, setBulkSetup] = useState("");
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const apply = (next: TradeListFilters) => {
    const params = writeTradeFilters(new URLSearchParams(searchParams.toString()), next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setSelection({});
  };

  // Debounced search text → URL.
  useEffect(() => {
    if (query === filters.q) return;
    const handle = window.setTimeout(() => apply({ ...filters, q: query }), 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply depends on the latest params only
  }, [query]);

  useEffect(() => {
    const onFocusSearch = (e: Event) => {
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener(FOCUS_SEARCH_EVENT, onFocusSearch);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, onFocusSearch);
  }, []);

  const filtered = useMemo(() => applyTradeFilters(rows, filters), [rows, filters]);
  const selectedIds = Object.keys(selection).filter((id) => selection[id] && filtered.some((r) => r.id === id));
  const activeCount = countActiveFilters({ ...filters, q: "" });

  const groups = useMemo(() => {
    const map = new Map<string, TradeRow[]>();
    for (const r of filtered) {
      const key = dayKey(r.openedAt, timeZone);
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [filtered, timeZone]);

  const chips: { key: string; label: string; remove: () => void }[] = [];
  const pushChips = (
    field: "symbols" | "setups" | "tags" | "results" | "sessions" | "mistakes",
    labelOf: (v: string) => string,
  ) => {
    for (const v of filters[field]) {
      chips.push({
        key: `${field}-${v}`,
        label: labelOf(v),
        remove: () => apply({ ...filters, [field]: filters[field].filter((x) => x !== v) }),
      });
    }
  };
  pushChips("results", (v) => RESULT_LABELS[v as keyof typeof RESULT_LABELS] ?? v);
  pushChips("symbols", (v) => v);
  pushChips("setups", (v) =>
    v === "none" ? "Ohne Setup" : (options.playbooks.find((p) => p.id === v)?.name ?? "Setup"),
  );
  pushChips("sessions", (v) => SESSION_LABELS[v as keyof typeof SESSION_LABELS] ?? v);
  pushChips("tags", (v) => options.tags.find((t) => t.id === v)?.name ?? "Tag");
  pushChips("mistakes", (v) => options.mistakes.find((m) => m.id === v)?.name ?? "Fehler");
  if (filters.direction) {
    chips.push({
      key: "direction",
      label: filters.direction === "long" ? "Long" : "Short",
      remove: () => apply({ ...filters, direction: null }),
    });
  }

  const runBulk = () => {
    startTransition(async () => {
      if (bulk === "delete") {
        const result = await deleteTrades(selectedIds);
        if (result.ok) toast.success(`${plural(result.data.count, "Trade", "Trades")} gelöscht`);
        else toast.error(result.error);
      } else if (bulk === "tags") {
        const result = await bulkUpdateTrades({ ids: selectedIds, addTagNames: bulkTags });
        if (result.ok) toast.success(`Tags bei ${plural(result.data.count, "Trade", "Trades")} hinzugefügt`);
        else toast.error(result.error);
      } else if (bulk === "setup") {
        const result = await bulkUpdateTrades({ ids: selectedIds, playbookId: bulkSetup || null });
        if (result.ok) toast.success(`Setup bei ${plural(result.data.count, "Trade", "Trades")} zugewiesen`);
        else toast.error(result.error);
      }
      setBulk(null);
      setBulkTags([]);
      setSelection({});
    });
  };

  if (rows.length === 0 && countActiveFilters(filters) === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={CandlestickChart}
          title="Keine Trades im Zeitraum"
          description="Erfasse einen Trade oder wähle oben einen anderen Zeitraum."
          action={
            <Button asChild>
              <Link href="/trades/new">
                <Plus /> Neuer Trade
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Symbol oder Notiz suchen"
              aria-label="Trades durchsuchen"
              className="h-11 w-full rounded-control border border-border bg-surface pr-9 pl-9 text-base outline-none placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:h-10 md:text-[14px]"
            />
            {query ? (
              <button
                type="button"
                aria-label="Suche leeren"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-faint hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <Button variant="outline" onClick={() => setSheetOpen(true)} className="relative" aria-label="Filter">
            <Filter /> <span className="hidden sm:inline">Filter</span>
            {activeCount > 0 ? (
              <span className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
                {activeCount}
              </span>
            ) : null}
          </Button>
        </div>
        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.remove}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-soft pr-2 pl-3 text-[13px] font-medium text-accent"
              >
                {chip.label}
                <X className="size-3.5" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => apply({ ...EMPTY_TRADE_FILTERS, q: filters.q })}
              className="h-8 px-2 text-[13px] font-medium text-muted-foreground hover:text-foreground"
            >
              Filter zurücksetzen
            </button>
          </div>
        ) : null}
      </div>

      {selectedIds.length > 0 ? (
        <div className="sticky top-[calc(env(safe-area-inset-top)+72px)] z-20 hidden items-center gap-2 rounded-control border border-border bg-surface-2 px-3 py-2 shadow-overlay lg:flex">
          <span className="text-[13px] font-medium">{selectedIds.length} ausgewählt</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setBulk("tags")}>
              <Tag /> Tags hinzufügen
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setBulk("setup")}>
              <BookMarked /> Setup zuweisen
            </Button>
            <Button size="sm" variant="secondary" className="text-loss" onClick={() => setBulk("delete")}>
              <Trash2 /> Löschen
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Auswahl aufheben" onClick={() => setSelection({})}>
              <X />
            </Button>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Filter}
            title="Keine Treffer"
            description="Keine Trades passen zu den gewählten Filtern."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  apply(EMPTY_TRADE_FILTERS);
                }}
              >
                Filter zurücksetzen
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden lg:block">
            <TradesTable rows={filtered} compact={compact} selection={selection} onSelectionChange={setSelection} />
          </div>
          {/* Phones: iOS list with sticky day headers, swipe actions and long-press menus. */}
          <div className="flex flex-col gap-4 md:hidden">
            {groups.map(([day, list]) => {
              const sums = sumByCurrency(list);
              return (
                <section key={day} className="ios-day-group">
                  <header className="ios-day-header">
                    <h2 className="text-[15px] font-semibold">{formatDayKey(day, "EEEE, d. MMMM")}</h2>
                    <span className="flex gap-2 text-[15px] font-semibold">
                      {sums.map(([currency, value]) => (
                        <PnlValue key={currency} value={value} currency={currency} />
                      ))}
                    </span>
                  </header>
                  <ul className="ios-group">
                    {list.map((trade) => (
                      <li key={trade.id}>
                        <TradeListRow trade={trade} timeZone={timeZone} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          <div className="hidden flex-col gap-3 md:flex lg:hidden">
            {groups.map(([day, list]) => {
              const sums = sumByCurrency(list);
              return (
                <section key={day} className="card">
                  <header className="sticky top-[calc(env(safe-area-inset-top)+56px)] z-10 flex items-center justify-between rounded-t-card border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur md:top-[calc(env(safe-area-inset-top)+64px)]">
                    <h2 className="text-[13px] font-semibold">{formatDayKey(day, "EEEE, d. MMMM")}</h2>
                    <span className="flex gap-2 text-[13px] font-semibold">
                      {sums.map(([currency, value]) => (
                        <PnlValue key={currency} value={value} currency={currency} />
                      ))}
                    </span>
                  </header>
                  <ul className="divide-y divide-border">
                    {list.map((trade) => (
                      <li key={trade.id}>
                        <TradeCard trade={trade} timeZone={timeZone} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          <Summary rows={filtered} />
        </>
      )}

      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        filters={filters}
        onApply={(f) => apply({ ...f, q: filters.q })}
        options={options}
      />

      <ResponsiveDialog
        open={bulk === "tags"}
        onOpenChange={(o) => !o && setBulk(null)}
        title="Tags hinzufügen"
        description={plural(selectedIds.length, "Trade", "Trades")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulk(null)}>
              Abbrechen
            </Button>
            <Button onClick={runBulk} disabled={pending || bulkTags.length === 0}>
              {pending ? <Spinner /> : null}
              Hinzufügen
            </Button>
          </>
        }
      >
        <TagInput value={bulkTags} onChange={setBulkTags} suggestions={options.tags} />
      </ResponsiveDialog>
      <ResponsiveDialog
        open={bulk === "setup"}
        onOpenChange={(o) => !o && setBulk(null)}
        title="Setup zuweisen"
        description={`${plural(selectedIds.length, "Trade", "Trades")} · Abgehakte Regeln werden zurückgesetzt.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulk(null)}>
              Abbrechen
            </Button>
            <Button onClick={runBulk} disabled={pending}>
              {pending ? <Spinner /> : null}
              Zuweisen
            </Button>
          </>
        }
      >
        <NativeSelect value={bulkSetup} onChange={(e) => setBulkSetup(e.target.value)} aria-label="Setup">
          <option value="">Kein Setup</option>
          {options.playbooks.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </ResponsiveDialog>
      <ConfirmDialog
        open={bulk === "delete"}
        onOpenChange={(o) => !o && setBulk(null)}
        title={`${plural(selectedIds.length, "Trade", "Trades")} löschen?`}
        description="Das kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        destructive
        pending={pending}
        onConfirm={runBulk}
      />
      <span className={cn("sr-only")} aria-live="polite">
        {filtered.length} Trades
      </span>
    </div>
  );
}
