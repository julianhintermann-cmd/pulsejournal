"use client";

import { Database, ExternalLink, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { optimizeDatabase } from "@/server/actions/settings";

export function AboutSettings({ rows, repoUrl }: { rows: { label: string; value: string }[]; repoUrl: string }) {
  const [pending, startTransition] = useTransition();
  const optimize = () =>
    startTransition(async () => {
      const result = await optimizeDatabase();
      if (result.ok) toast.success("Datenbank optimiert");
      else toast.error(result.error);
    });

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
            <dt className="text-small text-muted-foreground">{row.label}</dt>
            <dd className="truncate text-[14px] font-medium tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={optimize} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Database />}
          Datenbank optimieren
        </Button>
        <Button variant="ghost" asChild>
          <a href={repoUrl} target="_blank" rel="noreferrer">
            <ExternalLink /> GitHub-Repository
          </a>
        </Button>
      </div>
    </div>
  );
}
