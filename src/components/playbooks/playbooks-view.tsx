"use client";

import { BookMarked, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PlaybookFormDialog } from "@/components/playbooks/playbook-form-dialog";
import { RValue } from "@/components/r-value";
import { Sparkline } from "@/components/sparkline";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatPercent, plural } from "@/lib/format";
import type { PlaybookCardData } from "@/lib/playbooks";

export function PlaybooksView({
  cards,
  showArchived,
  hasArchived,
}: {
  cards: PlaybookCardData[];
  showArchived: boolean;
  hasArchived: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-muted-foreground">
          {plural(cards.filter((c) => !c.archived).length, "Playbook", "Playbooks")}
        </p>
        <div className="flex items-center gap-4">
          {hasArchived || showArchived ? (
            <label className="flex items-center gap-2 text-small text-muted-foreground">
              <Switch
                checked={showArchived}
                onCheckedChange={(v) => router.push(v ? "/playbooks?archived=1" : "/playbooks")}
              />
              Archivierte anzeigen
            </label>
          ) : null}
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> Neues Playbook
          </Button>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={BookMarked}
            title="Noch keine Playbooks"
            description="Beschreibe deine Setups mit klaren Regeln und miss, welche wirklich funktionieren."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus /> Neues Playbook
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={`/playbooks/${card.id}`}
              className="card flex flex-col overflow-hidden transition-colors md:hover:border-surface-3"
            >
              <div className="h-1" style={{ backgroundColor: card.color }} />
              <div className="flex flex-1 flex-col gap-4 p-4 md:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-h3">{card.name}</h2>
                    <p className="text-small text-muted-foreground">{plural(card.rules.length, "Regel", "Regeln")}</p>
                  </div>
                  {card.archived ? (
                    <span className="rounded-full bg-be-soft px-2 py-0.5 text-[11px] font-semibold text-be">
                      Archiviert
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col">
                    <span className="text-small text-muted-foreground">Trades</span>
                    <span className="text-h3 tabular-nums">{card.trades}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-small text-muted-foreground">Win Rate</span>
                    <span className="text-h3 tabular-nums">{formatPercent(card.winRate)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-small text-muted-foreground">Total R</span>
                    <RValue value={card.totalR} className="text-h3" />
                  </div>
                </div>
              </div>
              <Sparkline values={card.rCurve} height={40} />
            </Link>
          ))}
        </div>
      )}

      <PlaybookFormDialog open={open} onOpenChange={setOpen} playbook={null} />
    </div>
  );
}
