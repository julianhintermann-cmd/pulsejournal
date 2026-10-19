"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { THEMES, type Theme } from "@/lib/db/schema";
import { THEME_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { updateTheme } from "@/server/actions/settings";

const ICONS = { dark: Moon, light: Sun, system: Monitor } as const;

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.remove();
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = dark ? "#0A0B0F" : "#F6F7F9";
  document.head.appendChild(meta);
}

/** Dunkel / Hell / System segmented control; applies instantly and persists in the settings. */
export function ThemeToggle({ value }: { value: Theme }) {
  const [theme, setTheme] = useState<Theme>(value);
  const [, startTransition] = useTransition();

  const choose = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
    startTransition(async () => {
      const result = await updateTheme(next);
      if (!result.ok) toast.error(result.error);
    });
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex rounded-control border border-border bg-surface-2 p-1"
    >
      {THEMES.map((t) => {
        const Icon = ICONS[t];
        const active = theme === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(t)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-[7px] px-3 text-[13px] font-medium transition-colors md:h-8",
              active ? "bg-surface text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {THEME_LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}
