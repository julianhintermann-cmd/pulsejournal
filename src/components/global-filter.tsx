"use client";

import { CalendarRange, Check, ChevronDown, Wallet } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useApp } from "@/components/app-context";
import { GlassMenu, type MenuSection } from "@/components/ios/menu";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { filterToQuery, parseFilter, RANGE_KEYS, RANGE_LABELS, type FilterState, type RangeKey } from "@/lib/filter";
import { formatDayKey } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILTER_KEYS = ["range", "account", "from", "to"];

function useFilterState() {
  const { persistedFilter } = useApp();
  const searchParams = useSearchParams();
  return useMemo(
    () => parseFilter(new URLSearchParams(searchParams.toString()), persistedFilter),
    [searchParams, persistedFilter],
  );
}

function useApplyFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setPersistedFilter } = useApp();
  return (state: FilterState) => {
    const query = filterToQuery(state);
    setPersistedFilter(query);
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) params.delete(key);
    for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };
}

function rangeLabel(state: FilterState) {
  if (state.range === "custom" && state.from && state.to) {
    return `${formatDayKey(state.from, "dd.MM.yy")} – ${formatDayKey(state.to, "dd.MM.yy")}`;
  }
  return RANGE_LABELS[state.range];
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CustomRangeFields({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-from">Von</Label>
        <Input
          id="filter-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => onChange(e.target.value, to)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-to">Bis</Label>
        <Input
          id="filter-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => onChange(from, e.target.value)}
        />
      </div>
    </div>
  );
}

function OptionRow({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-10 w-full items-center justify-between gap-3 rounded-[8px] px-3 text-left text-[14px] transition-colors hover:bg-surface-2",
        selected && "text-foreground",
        !selected && "text-muted-foreground",
      )}
    >
      <span className="flex min-w-0 items-center gap-2 truncate">{children}</span>
      {selected ? <Check className="size-4 shrink-0 text-accent" /> : null}
    </button>
  );
}

function AccountOptions({ value, onSelect }: { value: string | null; onSelect: (id: string | null) => void }) {
  const { accounts } = useApp();
  return (
    <div className="flex flex-col">
      <OptionRow selected={value == null} onSelect={() => onSelect(null)}>
        Alle Konten
      </OptionRow>
      {accounts.map((a) => (
        <OptionRow key={a.id} selected={value === a.id} onSelect={() => onSelect(a.id)}>
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
          <span className="truncate">{a.name}</span>
          <span className="text-small text-muted-foreground">{a.currency}</span>
        </OptionRow>
      ))}
    </div>
  );
}

function DesktopRange({ state, apply }: { state: FilterState; apply: (s: FilterState) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(state.from ?? "");
  const [to, setTo] = useState(state.to ?? "");
  const [showCustom, setShowCustom] = useState(state.range === "custom");

  const onOpenChange = (next: boolean) => {
    if (next) {
      setFrom(state.from ?? "");
      setTo(state.to ?? todayKey());
      setShowCustom(state.range === "custom");
    }
    setOpen(next);
  };

  const choose = (range: RangeKey) => {
    if (range === "custom") {
      setShowCustom(true);
      return;
    }
    apply({ ...state, range, from: null, to: null });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 font-normal">
          <CalendarRange className="text-muted-foreground" />
          <span className="tabular-nums">{rangeLabel(state)}</span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1.5">
        {RANGE_KEYS.map((key) => (
          <OptionRow
            key={key}
            selected={key === "custom" ? showCustom || state.range === "custom" : state.range === key && !showCustom}
            onSelect={() => choose(key)}
          >
            {RANGE_LABELS[key]}
          </OptionRow>
        ))}
        {showCustom ? (
          <div className="flex flex-col gap-3 border-t border-border p-2 pt-3">
            <CustomRangeFields
              from={from}
              to={to}
              onChange={(f, t) => {
                setFrom(f);
                setTo(t);
              }}
            />
            <Button
              size="sm"
              disabled={!from || !to}
              onClick={() => {
                apply({ ...state, range: "custom", from, to });
                setOpen(false);
              }}
            >
              Anwenden
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function DesktopAccount({ state, apply }: { state: FilterState; apply: (s: FilterState) => void }) {
  const { accounts } = useApp();
  const [open, setOpen] = useState(false);
  const current = accounts.find((a) => a.id === state.accountId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-56 gap-2 font-normal">
          {current ? (
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: current.color }} />
          ) : (
            <Wallet className="text-muted-foreground" />
          )}
          <span className="truncate">{current ? current.name : "Alle Konten"}</span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5">
        <AccountOptions
          value={state.accountId}
          onSelect={(id) => {
            apply({ ...state, accountId: id });
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Desktop variant: inline controls for the top bar. */
export function GlobalFilterBar({ mode }: { mode: "full" | "account" }) {
  const state = useFilterState();
  const apply = useApplyFilter();
  return (
    <div className="flex items-center gap-2">
      {mode === "full" ? <DesktopRange state={state} apply={apply} /> : null}
      <DesktopAccount state={state} apply={apply} />
    </div>
  );
}

/**
 * Phone variant: the current value ("Dieser Monat ▾") inside the nav bar capsule. Opens a glass menu with the
 * periods and accounts; "Benutzerdefiniert…" opens a sheet with native date pickers.
 */
export function GlobalFilterSheetButton({ mode }: { mode: "full" | "account" }) {
  const state = useFilterState();
  const apply = useApplyFilter();
  const { accounts } = useApp();
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const account = accounts.find((a) => a.id === state.accountId);
  const label = mode === "full" ? rangeLabel(state) : (account?.name ?? "Alle Konten");

  const openCustom = () => {
    setFrom(state.from ?? "");
    setTo(state.to ?? todayKey());
    setCustomOpen(true);
  };

  const sections: MenuSection[] = [
    ...(mode === "full"
      ? [
          {
            items: RANGE_KEYS.map((key) => ({
              label: key === "custom" ? `${RANGE_LABELS[key]}…` : RANGE_LABELS[key],
              checked: state.range === key,
              onSelect: () => (key === "custom" ? openCustom() : apply({ ...state, range: key, from: null, to: null })),
            })),
          },
        ]
      : []),
    {
      items: [
        {
          label: "Alle Konten",
          checked: state.accountId == null,
          onSelect: () => apply({ ...state, accountId: null }),
        },
        ...accounts.map((a) => ({
          label: `${a.name} · ${a.currency}`,
          checked: state.accountId === a.id,
          onSelect: () => apply({ ...state, accountId: a.id }),
        })),
      ],
    },
  ];

  const applyCustom = () => {
    if (!from || !to) return;
    apply({ ...state, range: "custom", from, to });
    setCustomOpen(false);
  };

  return (
    <>
      <GlassMenu sections={sections} label="Filter">
        {(trigger) => (
          <button
            {...trigger}
            type="button"
            aria-label={`Filter: ${label}${mode === "full" && account ? `, ${account.name}` : ""}`}
            className="flex h-11 max-w-[11.5rem] min-w-0 items-center gap-1.5 rounded-full pr-2.5 pl-4 text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {mode === "full" && account ? (
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: account.color }} />
            ) : null}
            <span className="truncate tabular-nums">{label}</span>
            <ChevronDown className="size-4 shrink-0 opacity-60" strokeWidth={2.4} />
          </button>
        )}
      </GlassMenu>
      <ResponsiveDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        title="Benutzerdefiniert"
        description="Zeitraum für Statistiken und Trades"
        confirm={{ label: "Anwenden", onConfirm: applyCustom, disabled: !from || !to }}
        footer={
          <Button disabled={!from || !to} onClick={applyCustom}>
            Anwenden
          </Button>
        }
      >
        <CustomRangeFields
          from={from}
          to={to}
          onChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
        />
      </ResponsiveDialog>
    </>
  );
}
