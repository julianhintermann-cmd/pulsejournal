import { createHash } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { accounts, importLog, trades } from "@/lib/db/schema";
import { dedupeKey, mapRows, parseCsv, type MappedRow } from "@/lib/import/csv";
import { saveTrade, TradeSaveError } from "@/lib/trades/save";
import type { CsvMapping, TradeInput } from "@/lib/validation";

export function importHash(accountId: string, row: MappedRow) {
  return createHash("sha256").update(dedupeKey(accountId, row)).digest("hex");
}

export function toTradeInput(row: MappedRow, accountId: string, playbookId: string | null): TradeInput {
  const opening = row.direction === "long" ? "buy" : "sell";
  const closing = row.direction === "long" ? "sell" : "buy";
  const executions: TradeInput["executions"] = [
    { side: opening, qty: row.qty, price: row.entry, fee: 0, executedAt: row.openedAt },
  ];
  if (row.exit != null && row.closedAt != null) {
    executions.push({ side: closing, qty: row.qty, price: row.exit, fee: 0, executedAt: row.closedAt });
  }
  return {
    accountId,
    symbol: row.symbol,
    direction: row.direction,
    playbookId,
    timeframe: null,
    executions,
    initialStop: row.stop,
    initialTarget: row.target,
    // A P&L column from the broker is authoritative (includes their FX and contract specifics).
    pnlMode: row.netPnl != null ? "manual" : "auto",
    manualNetPnl: row.netPnl,
    fxRate: 1,
    fees: row.fees,
    swap: row.swap,
    executionRating: null,
    confidence: null,
    emotionBefore: null,
    emotionAfter: null,
    mistakeIds: [],
    tagNames: [],
    ruleChecks: [],
    notes: row.notes,
    tradingviewUrl: null,
  };
}

export type ImportSummary = {
  total: number;
  imported: number;
  skipped: number;
  errors: { row: number; error: string }[];
};

export function runCsvImport(opts: {
  text: string;
  fileName: string;
  mapping: CsvMapping;
  accountId: string;
  playbookId: string | null;
  skipDuplicates: boolean;
  timeZone: string;
}): ImportSummary {
  const db = getDb();
  const account = db.select().from(accounts).where(eq(accounts.id, opts.accountId)).get();
  if (!account) throw new TradeSaveError("Konto nicht gefunden.");
  const parsed = parseCsv(opts.text, opts.mapping.delimiter);
  const results = mapRows(parsed, opts.mapping, opts.timeZone);
  const summary: ImportSummary = { total: results.length, imported: 0, skipped: 0, errors: [] };

  const hashes = results.flatMap((r) => (r.ok ? [importHash(opts.accountId, r.row)] : []));
  const existing = new Set(
    hashes.length > 0
      ? db
          .select({ hash: trades.importHash })
          .from(trades)
          .where(inArray(trades.importHash, hashes))
          .all()
          .map((t) => t.hash)
      : [],
  );
  const seen = new Set<string>();

  for (const result of results) {
    if (!result.ok) {
      summary.skipped += 1;
      summary.errors.push({ row: result.index + 2, error: result.error });
      continue;
    }
    const hash = importHash(opts.accountId, result.row);
    const duplicate = existing.has(hash) || seen.has(hash);
    if (duplicate && opts.skipDuplicates) {
      summary.skipped += 1;
      continue;
    }
    try {
      const { id } = saveTrade(null, toTradeInput(result.row, opts.accountId, opts.playbookId));
      // The hash is unique: duplicates imported on purpose keep no hash.
      if (!duplicate) db.update(trades).set({ importHash: hash }).where(eq(trades.id, id)).run();
      seen.add(hash);
      summary.imported += 1;
    } catch (error) {
      summary.skipped += 1;
      summary.errors.push({ row: result.index + 2, error: error instanceof Error ? error.message : "Fehler" });
    }
  }

  db.insert(importLog)
    .values({
      source: "csv",
      fileName: opts.fileName.slice(0, 200),
      rowsTotal: summary.total,
      rowsImported: summary.imported,
      rowsSkipped: summary.skipped,
    })
    .run();
  return summary;
}
