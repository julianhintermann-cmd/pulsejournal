"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/** Multi-select for tags with create-on-type (Enter or comma adds the typed tag). */
export function TagInput({
  value,
  onChange,
  suggestions,
  id,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  suggestions: { name: string; color: string }[];
  id?: string;
}) {
  const [draft, setDraft] = useState("");
  const colorOf = (name: string) => suggestions.find((s) => s.name.toLowerCase() === name.toLowerCase())?.color;

  const add = (raw: string) => {
    const name = raw.trim().slice(0, 60);
    if (!name || value.some((v) => v.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    const existing = suggestions.find((s) => s.name.toLowerCase() === name.toLowerCase());
    onChange([...value, existing?.name ?? name]);
    setDraft("");
  };

  const available = suggestions.filter(
    (s) =>
      !value.some((v) => v.toLowerCase() === s.name.toLowerCase()) &&
      s.name.toLowerCase().includes(draft.trim().toLowerCase()),
  );
  const canCreate = draft.trim() && !suggestions.some((s) => s.name.toLowerCase() === draft.trim().toLowerCase());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border border-border bg-surface-2 p-1.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring md:min-h-10">
        {value.map((name) => (
          <span
            key={name}
            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-3 pr-1 pl-2.5 text-[13px] font-medium"
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: colorOf(name) ?? "var(--text-faint)" }} />
            {name}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== name))}
              aria-label={`${name} entfernen`}
              className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length === 0 ? "Tag eingeben und Enter drücken" : ""}
          className="h-7 min-w-32 flex-1 bg-transparent px-1.5 text-base outline-none placeholder:text-faint md:text-[14px]"
        />
      </div>
      {available.length > 0 || canCreate ? (
        <div className="flex flex-wrap gap-1.5">
          {canCreate ? (
            <button
              type="button"
              onClick={() => add(draft)}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-border px-3 text-[13px] text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" /> „{draft.trim()}“ anlegen
            </button>
          ) : null}
          {available.slice(0, 12).map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => add(s.name)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground",
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
