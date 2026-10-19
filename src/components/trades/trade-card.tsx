import Link from "next/link";

import { DirectionChip } from "@/components/direction-chip";
import { PnlValue } from "@/components/pnl-value";
import { RValue } from "@/components/r-value";
import { ResultChip } from "@/components/result-chip";
import type { TradeRow } from "@/lib/db/queries";
import { formatTime } from "@/lib/format";
import { SESSION_LABELS } from "@/lib/sessions";
import { uploadUrl } from "@/lib/upload-url";

/** Mobile trade row: symbol + direction left, P&L + R right, setup · session · time below. */
export function TradeCard({ trade, timeZone }: { trade: TradeRow; timeZone: string }) {
  return (
    <Link
      href={`/trades/${trade.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-surface-2 [li:last-child>&]:rounded-b-card"
    >
      {trade.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- auth-protected upload served by the API route
        <img
          src={uploadUrl(trade.thumb)}
          alt=""
          loading="lazy"
          className="size-11 shrink-0 rounded-[10px] bg-surface-2 object-cover"
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold">{trade.symbol}</span>
          <DirectionChip direction={trade.direction} size="sm" />
          {trade.result === "open" ? <ResultChip result="open" size="sm" /> : null}
        </div>
        <p className="truncate text-small text-muted-foreground">
          {[trade.playbook?.name, SESSION_LABELS[trade.session], formatTime(trade.openedAt, timeZone)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {trade.netPnl != null ? (
          <PnlValue value={trade.netPnl} currency={trade.currency} className="text-[15px] font-semibold" />
        ) : (
          <span className="text-[15px] text-faint">–</span>
        )}
        <RValue value={trade.rMultiple} className="text-small" />
      </div>
    </Link>
  );
}
