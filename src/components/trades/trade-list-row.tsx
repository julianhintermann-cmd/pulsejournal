"use client";

import { Copy, Pencil, Share, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DirectionChip } from "@/components/direction-chip";
import { ContextMenu } from "@/components/ios/menu";
import { SwipeableRow } from "@/components/ios/swipeable-row";
import { PnlValue } from "@/components/pnl-value";
import { ResultChip } from "@/components/result-chip";
import { RValue } from "@/components/r-value";
import type { TradeRow } from "@/lib/db/queries";
import { formatDateTime, formatMoney, formatR, formatTime } from "@/lib/format";
import { SESSION_LABELS } from "@/lib/sessions";
import { uploadUrl } from "@/lib/upload-url";
import { deleteTrade, duplicateTrade, restoreTrade } from "@/server/actions/trades";

/** Text summary for the share sheet (Web Share API). */
function shareText(trade: TradeRow, timeZone: string) {
  return [
    `${trade.symbol} ${trade.direction === "long" ? "Long" : "Short"}`,
    trade.netPnl != null ? `Netto P&L ${formatMoney(trade.netPnl, trade.currency, { signed: true })}` : "Offen",
    trade.rMultiple != null ? formatR(trade.rMultiple) : null,
    trade.playbook?.name,
    formatDateTime(trade.openedAt, timeZone),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Phone trade row (section 6): symbol + direction left, net P&L + R right, setup · session · time below, optional
 * 40 px thumbnail. Swipe left: Löschen / Bearbeiten (full swipe deletes with undo); swipe right: Duplizieren;
 * long-press: context menu with Bearbeiten, Duplizieren, Teilen and Löschen.
 */
export function TradeListRow({ trade, timeZone }: { trade: TradeRow; timeZone: string }) {
  const router = useRouter();

  const edit = () => router.push(`/trades/${trade.id}/edit`);
  const duplicate = async () => {
    const result = await duplicateTrade(trade.id);
    if (!result.ok) return toast.error(result.error);
    toast.success("Trade dupliziert – Ausführungen ergänzen");
    router.push(`/trades/${result.data.id}/edit?mode=detailed`);
  };
  const remove = async () => {
    const result = await deleteTrade(trade.id);
    if (!result.ok) return toast.error(result.error);
    router.refresh();
    toast("Trade gelöscht", {
      action: {
        label: "Rückgängig",
        onClick: async () => {
          const restored = await restoreTrade(trade.id);
          if (restored.ok) router.refresh();
          else toast.error(restored.error);
        },
      },
    });
  };
  const share = async () => {
    const text = shareText(trade, timeZone);
    try {
      if (navigator.share) await navigator.share({ title: `${trade.symbol} Trade`, text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("In die Zwischenablage kopiert");
      }
    } catch {
      // share sheet dismissed
    }
  };

  return (
    <ContextMenu
      label={`${trade.symbol} Trade`}
      sections={[
        {
          items: [
            { label: "Bearbeiten", icon: Pencil, onSelect: edit },
            { label: "Duplizieren", icon: Copy, onSelect: () => void duplicate() },
            { label: "Teilen", icon: Share, onSelect: () => void share() },
          ],
        },
        { items: [{ label: "Löschen", icon: Trash2, destructive: true, onSelect: () => void remove() }] },
      ]}
    >
      <SwipeableRow
        leading={[{ label: "Duplizieren", icon: Copy, color: "#5E5CE6", onAction: () => void duplicate() }]}
        trailing={[
          { label: "Löschen", icon: Trash2, color: "var(--loss)", onAction: () => void remove() },
          { label: "Bearbeiten", icon: Pencil, color: "var(--accent)", onAction: edit },
        ]}
      >
        <Link href={`/trades/${trade.id}`} prefetch={false} className="ios-row ios-row--interactive" draggable={false}>
          {trade.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- auth-protected upload served by the API route
            <img
              src={uploadUrl(trade.thumb)}
              alt=""
              loading="lazy"
              draggable={false}
              className="size-10 shrink-0 rounded-[10px] bg-surface-2 object-cover"
            />
          ) : null}
          <span className="ios-row__body py-[10px]">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[17px] font-semibold">{trade.symbol}</span>
                <DirectionChip direction={trade.direction} size="sm" />
                {trade.result === "open" ? <ResultChip result="open" size="sm" /> : null}
              </span>
              <span className="truncate text-[15px] text-muted-foreground">
                {[trade.playbook?.name, SESSION_LABELS[trade.session], formatTime(trade.openedAt, timeZone)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              {trade.netPnl != null ? (
                <PnlValue value={trade.netPnl} currency={trade.currency} className="text-[17px] font-semibold" />
              ) : (
                <span className="text-[17px] text-faint">–</span>
              )}
              <RValue value={trade.rMultiple} className="text-[15px] !text-muted-foreground" />
            </span>
          </span>
        </Link>
      </SwipeableRow>
    </ContextMenu>
  );
}
