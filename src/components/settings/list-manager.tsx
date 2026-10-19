"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ListItem } from "@/lib/db/queries";
import { cn } from "@/lib/utils";
import {
  createListItem,
  deleteListItem,
  renameListItem,
  reorderListItems,
  type ListKind,
} from "@/server/actions/lists";

export function ListManager({
  kind,
  items,
  placeholder,
  reorderable,
}: {
  kind: ListKind;
  items: ListItem[];
  placeholder: string;
  reorderable?: boolean;
}) {
  const [order, setOrder] = useState(items);
  const [synced, setSynced] = useState(items);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleting, setDeleting] = useState<ListItem | null>(null);
  const [pending, startTransition] = useTransition();

  // Keep local order in sync when the server sends a new list (after add / rename / delete).
  if (items !== synced) {
    setSynced(items);
    setOrder(items);
  }

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createListItem(kind, name);
      if (!result.ok) toast.error(result.error);
      else setNewName("");
    });
  };

  const saveRename = (id: string) => {
    startTransition(async () => {
      const result = await renameListItem(kind, id, editName);
      if (!result.ok) toast.error(result.error);
      else setEditingId(null);
    });
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= order.length || kind === "tags") return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    startTransition(async () => {
      const result = await reorderListItems(
        kind,
        next.map((i) => i.id),
      );
      if (!result.ok) toast.error(result.error);
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteListItem(kind, deleting.id);
      if (!result.ok) toast.error(result.error);
      setDeleting(null);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={placeholder} maxLength={60} />
        <Button type="submit" variant="secondary" disabled={pending || !newName.trim()} aria-label="Hinzufügen">
          <Plus /> <span className="hidden sm:inline">Hinzufügen</span>
        </Button>
      </form>
      {order.length === 0 ? (
        <p className="py-3 text-center text-small text-muted-foreground">Noch keine Einträge.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
          {order.map((item, index) => (
            <li key={item.id} className="flex min-h-12 items-center gap-2 px-3 py-1.5">
              {item.color ? (
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              ) : null}
              {editingId === item.id ? (
                <form
                  className="flex flex-1 items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveRename(item.id);
                  }}
                >
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={60}
                    className="h-9 md:h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button type="submit" variant="ghost" size="icon-sm" aria-label="Speichern" disabled={pending}>
                    <Check />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Abbrechen"
                    onClick={() => setEditingId(null)}
                  >
                    <X />
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
                    <span className="truncate text-[14px] sm:flex-1">{item.name}</span>
                    <span className="shrink-0 text-small text-muted-foreground tabular-nums">{item.count} Trades</span>
                  </span>
                  <div className="-mr-1 flex shrink-0 items-center">
                    {reorderable ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Nach oben"
                          disabled={index === 0 || pending}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Nach unten"
                          disabled={index === order.length - 1 || pending}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown />
                        </Button>
                      </>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Umbenennen"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditName(item.name);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Löschen"
                      className={cn("text-muted-foreground hover:text-loss")}
                      onClick={() => setDeleting(item)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`„${deleting?.name ?? ""}“ löschen?`}
        description={
          deleting && deleting.count > 0
            ? `Wird bei ${deleting.count} Trades entfernt.`
            : "Der Eintrag wird bei keinem Trade verwendet."
        }
        confirmLabel="Löschen"
        destructive
        pending={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
