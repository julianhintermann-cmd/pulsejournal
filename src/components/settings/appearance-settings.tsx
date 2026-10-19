"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme-toggle";
import { Switch } from "@/components/ui/switch";
import type { Theme } from "@/lib/db/schema";
import { updateAppearanceSettings } from "@/server/actions/settings";

export function AppearanceSettings({ theme, compactTables }: { theme: Theme; compactTables: boolean }) {
  const [compact, setCompact] = useState(compactTables);
  const [, startTransition] = useTransition();

  const toggleCompact = (next: boolean) => {
    setCompact(next);
    startTransition(async () => {
      const result = await updateAppearanceSettings({
        theme: (document.documentElement.dataset.theme as Theme) || theme,
        compactTables: next,
      });
      if (!result.ok) {
        setCompact(!next);
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col divide-y divide-border">
      <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[14px] font-medium">Theme</p>
          <p className="text-small text-muted-foreground">Dunkel ist der Standard.</p>
        </div>
        <ThemeToggle value={theme} />
      </div>
      <label className="flex items-center justify-between gap-4 pt-5">
        <div>
          <p className="text-[14px] font-medium">Kompakte Tabellen</p>
          <p className="text-small text-muted-foreground">Geringere Zeilenhöhe in der Trade-Tabelle.</p>
        </div>
        <Switch checked={compact} onCheckedChange={toggleCompact} />
      </label>
    </div>
  );
}
