"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_SESSIONS, isValidTime, SESSION_LABELS, type SessionsConfig } from "@/lib/sessions";
import { updateSessionSettings } from "@/server/actions/settings";

const KEYS = ["asia", "london", "newyork"] as const;

export function SessionsSettings({ initial }: { initial: SessionsConfig }) {
  const [value, setValue] = useState<SessionsConfig>(initial);
  const [pending, startTransition] = useTransition();
  const invalid = KEYS.some((k) => !isValidTime(value[k].start) || !isValidTime(value[k].end));
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);

  const save = () =>
    startTransition(async () => {
      const result = await updateSessionSettings(value);
      if (!result.ok) toast.error(result.error);
      else toast.success(`Sessions gespeichert · ${result.data.recomputed} Trades neu klassifiziert`);
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col divide-y divide-border rounded-control border border-border">
        {KEYS.map((key) => (
          <div key={key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[14px] font-medium">{SESSION_LABELS[key]}</span>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                aria-label={`${SESSION_LABELS[key]} Beginn`}
                value={value[key].start}
                onChange={(e) => setValue((v) => ({ ...v, [key]: { ...v[key], start: e.target.value } }))}
                className="w-32 tabular-nums"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                aria-label={`${SESSION_LABELS[key]} Ende`}
                value={value[key].end}
                onChange={(e) => setValue((v) => ({ ...v, [key]: { ...v[key], end: e.target.value } }))}
                className="w-32 tabular-nums"
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-small text-faint">
        Zeiten in der Anzeige-Zeitzone. Beginn inklusive, Ende exklusive; alles andere gilt als „Ausserhalb“. Die
        Einordnung richtet sich nach der ersten Einstiegs-Ausführung.
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => setValue(DEFAULT_SESSIONS)} disabled={pending}>
          Standard wiederherstellen
        </Button>
        <Button onClick={save} disabled={pending || invalid || !dirty}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Speichern
        </Button>
      </div>
    </div>
  );
}
