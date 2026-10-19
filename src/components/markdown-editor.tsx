"use client";

import { Bold, Italic, Link2, List, ListChecks } from "lucide-react";
import { useRef, useState } from "react";

import { MarkdownView } from "@/components/markdown-view";
import { cn } from "@/lib/utils";

type Action = {
  label: string;
  icon: typeof Bold;
  apply: (selected: string) => { text: string; cursor: [number, number] };
};

const ACTIONS: Action[] = [
  { label: "Fett", icon: Bold, apply: (s) => ({ text: `**${s || "fett"}**`, cursor: [2, 2 + (s || "fett").length] }) },
  {
    label: "Kursiv",
    icon: Italic,
    apply: (s) => ({ text: `_${s || "kursiv"}_`, cursor: [1, 1 + (s || "kursiv").length] }),
  },
  {
    label: "Liste",
    icon: List,
    apply: (s) => {
      const text = (s || "Punkt")
        .split("\n")
        .map((l) => `- ${l}`)
        .join("\n");
      return { text, cursor: [text.length, text.length] };
    },
  },
  {
    label: "Checkliste",
    icon: ListChecks,
    apply: (s) => {
      const text = (s || "Aufgabe")
        .split("\n")
        .map((l) => `- [ ] ${l}`)
        .join("\n");
      return { text, cursor: [text.length, text.length] };
    },
  },
  {
    label: "Link",
    icon: Link2,
    apply: (s) => {
      const label = s || "Text";
      return { text: `[${label}](https://)`, cursor: [label.length + 3, label.length + 11] };
    },
  },
];

/** Plain textarea with a small formatting toolbar and a preview tab (section 2: markdown editing). */
export function MarkdownEditor({
  id,
  value,
  onChange,
  placeholder,
  minRows = 5,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");

  const run = (action: Action) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const needsNewline =
      (action.label === "Liste" || action.label === "Checkliste") && start > 0 && value[start - 1] !== "\n";
    const prefix = needsNewline ? "\n" : "";
    const { text, cursor } = action.apply(selected);
    const next = value.slice(0, start) + prefix + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length + cursor[0], start + prefix.length + cursor[1]);
    });
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-control border border-border bg-surface-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b border-border px-1 py-1 sm:px-1.5">
        <div className="flex items-center gap-0.5" role="tablist">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "h-8 rounded-[7px] px-2 text-[13px] font-medium transition-colors sm:px-2.5",
                tab === t ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "write" ? "Schreiben" : "Vorschau"}
            </button>
          ))}
        </div>
        {tab === "write" ? (
          <div className="ml-auto flex items-center">
            {ACTIONS.map((a) => (
              <button
                key={a.label}
                type="button"
                title={a.label}
                aria-label={a.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(a)}
                className="inline-flex size-7 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground sm:size-8"
              >
                <a.icon className="size-4" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {tab === "write" ? (
        <textarea
          id={id}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={minRows}
          className="block w-full resize-y bg-transparent px-3 py-2.5 text-base leading-[22px] text-foreground outline-none placeholder:text-faint md:text-[14px]"
        />
      ) : (
        <div className="min-h-[120px] px-3 py-2.5">
          {value.trim() ? <MarkdownView value={value} /> : <p className="text-body text-faint">Nichts zum Anzeigen.</p>}
        </div>
      )}
    </div>
  );
}
