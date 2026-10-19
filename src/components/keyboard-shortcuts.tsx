"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ResponsiveDialog } from "@/components/responsive-dialog";

export const FOCUS_SEARCH_EVENT = "pulse:focus-search";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘", "K"], label: "Befehlspalette öffnen" },
  { keys: ["N"], label: "Neuer Trade" },
  { keys: ["G", "D"], label: "Übersicht" },
  { keys: ["G", "T"], label: "Trades" },
  { keys: ["G", "C"], label: "Kalender" },
  { keys: ["G", "J"], label: "Journal" },
  { keys: ["G", "S"], label: "Statistiken" },
  { keys: ["/"], label: "Suche fokussieren" },
  { keys: ["⌘", "S"], label: "Formular speichern" },
  { keys: ["Esc"], label: "Abbrechen / schliessen" },
  { keys: ["?"], label: "Diese Hilfe anzeigen" },
];

const GO_TARGETS: Record<string, string> = { d: "/", t: "/trades", c: "/calendar", j: "/journal", s: "/stats" };

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Global desktop keyboard shortcuts (section 8.13) and the `?` help overlay. */
export function KeyboardShortcuts({ onOpenCommand }: { onOpenCommand: () => void }) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingG = useRef<number | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenCommand();
        return;
      }
      if (mod || event.altKey || event.defaultPrevented || isTypingTarget(event.target)) return;
      if (document.querySelector("[role=dialog]")) return;

      const key = event.key.toLowerCase();
      if (pendingG.current != null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const target = GO_TARGETS[key];
        if (target) {
          event.preventDefault();
          router.push(target);
        }
        return;
      }
      if (key === "g") {
        pendingG.current = window.setTimeout(() => {
          pendingG.current = null;
        }, 1000);
        return;
      }
      if (key === "n") {
        event.preventDefault();
        router.push("/trades/new");
      } else if (event.key === "/") {
        event.preventDefault();
        const handled = !window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT, { cancelable: true }));
        if (!handled) onOpenCommand();
      } else if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, onOpenCommand]);

  return (
    <ResponsiveDialog open={helpOpen} onOpenChange={setHelpOpen} title="Tastenkürzel">
      <ul className="flex flex-col divide-y divide-border">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-body">{s.label}</span>
            <span className="flex items-center gap-1">
              {s.keys.map((k) => (
                <kbd
                  key={k}
                  className="inline-flex h-6 min-w-6 items-center justify-center rounded-[6px] border border-border bg-surface-2 px-1.5 font-sans text-[12px] text-muted-foreground"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </ResponsiveDialog>
  );
}
