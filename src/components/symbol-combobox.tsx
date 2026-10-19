"use client";

import { Clock } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

/** Symbol input with suggestions: recently traded symbols first, then all known instruments. */
export function SymbolCombobox({
  id,
  value,
  onChange,
  onCommit,
  symbols,
  recent,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Called when the user picks a suggestion or leaves the field. */
  onCommit: (value: string) => void;
  symbols: string[];
  recent: string[];
  invalid?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const options = useMemo(() => {
    const q = value.trim().toUpperCase();
    const recentSet = new Set(recent);
    const ordered = [...recent, ...symbols.filter((s) => !recentSet.has(s))];
    return ordered.filter((s) => !q || s.includes(q)).slice(0, 8);
  }, [value, symbols, recent]);

  const pick = (symbol: string) => {
    onChange(symbol);
    onCommit(symbol);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        placeholder="z. B. EURUSD"
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          if (value.trim()) onCommit(value.trim().toUpperCase());
        }}
        onKeyDown={(e) => {
          if (!open || options.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % options.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + options.length) % options.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(options[active] ?? value);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className={cn(
          "h-11 w-full rounded-control border border-border bg-surface-2 px-3 text-base font-semibold tracking-wide text-foreground uppercase outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-faint placeholder:normal-case md:h-10 md:text-[14px]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-loss",
        )}
      />
      {open && options.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-1.5 max-h-72 overflow-y-auto rounded-[12px] border border-border bg-surface p-1 shadow-overlay"
        >
          {options.map((symbol, index) => (
            <li
              key={symbol}
              role="option"
              aria-selected={index === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(symbol);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex h-10 cursor-pointer items-center justify-between rounded-[8px] px-3 text-[14px] font-medium",
                index === active && "bg-surface-2",
              )}
            >
              {symbol}
              {recent.includes(symbol) ? (
                <Clock className="size-3.5 text-faint" aria-label="Zuletzt gehandelt" />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
