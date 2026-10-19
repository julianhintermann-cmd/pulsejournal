"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Ellipsis, Pencil, Share, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { GlassSurface } from "@/components/ios/glass";
import { GlassMenu } from "@/components/ios/menu";
import { NavBarActions } from "@/components/ios/nav-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteTrade, duplicateTrade, restoreTrade } from "@/server/actions/trades";

export function TradeActions({
  id,
  prevId,
  nextId,
  shareText,
}: {
  id: string;
  prevId: string | null;
  nextId: string | null;
  /** Text summary for the share sheet. */
  shareText: string;
}) {
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

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Trade", text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        toast.success("In die Zwischenablage kopiert");
      }
    } catch {
      // share sheet dismissed
    }
  };

  const barButton =
    "flex h-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-35";

  return (
    <>
      {/* Phones: one glass capsule in the nav bar – previous/next (like Mail), Bearbeiten and the "…" menu. */}
      <NavBarActions>
        <GlassSurface shape="capsule" className="flex h-11 items-center px-1">
          <button
            type="button"
            aria-label="Vorheriger Trade"
            disabled={!prevId}
            onClick={() => prevId && router.push(`/trades/${prevId}`)}
            className={cn(barButton, "w-9")}
          >
            <ChevronUp className="size-[22px]" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            aria-label="Nächster Trade"
            disabled={!nextId}
            onClick={() => nextId && router.push(`/trades/${nextId}`)}
            className={cn(barButton, "w-9")}
          >
            <ChevronDown className="size-[22px]" strokeWidth={2.2} />
          </button>
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--ios-separator)]" />
          <Link href={`/trades/${id}/edit`} className={cn(barButton, "px-2.5 text-[16px] font-medium")}>
            Bearbeiten
          </Link>
          <GlassMenu
            label="Weitere Aktionen"
            sections={[
              {
                items: [
                  { label: "Duplizieren", icon: Copy, onSelect: duplicate },
                  { label: "Teilen", icon: Share, onSelect: () => void share() },
                ],
              },
              { items: [{ label: "Löschen", icon: Trash2, destructive: true, onSelect: () => setConfirmOpen(true) }] },
            ]}
          >
            {(trigger) => (
              <button {...trigger} type="button" aria-label="Weitere Aktionen" className={cn(barButton, "w-10")}>
                <Ellipsis className="size-[22px]" strokeWidth={2.2} />
              </button>
            )}
          </GlassMenu>
        </GlassSurface>
      </NavBarActions>
      <div className="flex flex-wrap items-center gap-2 max-md:hidden">
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
    </>
  );
}
