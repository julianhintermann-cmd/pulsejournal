"use client";

import { ChevronLeft, ChevronRight, Copy, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteTrade, duplicateTrade, restoreTrade } from "@/server/actions/trades";

export function TradeActions({ id, prevId, nextId }: { id: string; prevId: string | null; nextId: string | null }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const duplicate = () =>
    startTransition(async () => {
      const result = await duplicateTrade(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Trade dupliziert – Ausführungen ergänzen");
      router.push(`/trades/${result.data.id}/edit?mode=detailed`);
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteTrade(id);
      setConfirmOpen(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push("/trades");
      toast("Trade gelöscht", {
        duration: 5000,
        action: {
          label: "Rückgängig",
          onClick: async () => {
            const restored = await restoreTrade(id);
            if (restored.ok) {
              toast.success("Trade wiederhergestellt");
              router.push(`/trades/${id}`);
            } else toast.error(restored.error);
          },
        },
      });
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm">
        <Link href={`/trades/${id}/edit`}>
          <Pencil /> Bearbeiten
        </Link>
      </Button>
      <Button variant="secondary" size="sm" onClick={duplicate} disabled={pending}>
        <Copy /> Duplizieren
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
        className="text-loss"
      >
        <Trash2 /> Löschen
      </Button>
      <div className="ml-auto flex items-center gap-1">
        {prevId ? (
          <Button asChild variant="ghost" size="icon-sm" aria-label="Vorheriger Trade">
            <Link href={`/trades/${prevId}`}>
              <ChevronLeft />
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="Vorheriger Trade" disabled>
            <ChevronLeft />
          </Button>
        )}
        {nextId ? (
          <Button asChild variant="ghost" size="icon-sm" aria-label="Nächster Trade">
            <Link href={`/trades/${nextId}`}>
              <ChevronRight />
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="Nächster Trade" disabled>
            <ChevronRight />
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Trade wirklich löschen?"
        description="Das kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </div>
  );
}
