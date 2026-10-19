import { cookies } from "next/headers";
import Papa from "papaparse";

import { getApiUser, unauthorized } from "@/lib/auth/guard";
import { listTrades } from "@/lib/db/queries";
import { FILTER_COOKIE, parseFilter, resolveFilter } from "@/lib/filter";
import { formatDateTime } from "@/lib/format";
import { RESULT_LABELS } from "@/lib/labels";
import { SESSION_LABELS } from "@/lib/sessions";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function num(value: number | null | undefined, decimals?: number) {
  if (value == null || !Number.isFinite(value)) return "";
  return decimals != null ? value.toFixed(decimals) : String(value);
}

/** All trades in the current global filter as CSV (UTF-8 with BOM, ";" delimiter). */
export async function GET(request: Request) {
  if (!(await getApiUser())) return unauthorized();
  const settings = getSettings();
  const url = new URL(request.url);
  const persisted = (await cookies()).get(FILTER_COOKIE)?.value;
  const state = parseFilter(url.searchParams, persisted ? decodeURIComponent(persisted) : null);
  const filter = resolveFilter(state, { timeZone: settings.displayTimezone, weekStartsOn: settings.weekStartsOn });
  const rows = listTrades(filter).map((t) => ({
    ID: t.id,
    Datum: formatDateTime(t.openedAt, settings.displayTimezone),
    Symbol: t.symbol,
    Richtung: t.direction === "long" ? "Long" : "Short",
    Setup: t.playbook?.name ?? "",
    Session: SESSION_LABELS[t.session],
    Einstieg: num(t.entryAvg),
    Ausstieg: num(t.exitAvg),
    Menge: num(t.qty),
    R: num(t.rMultiple, 2),
    "Netto P&L": num(t.netPnl, 2),
    Währung: t.currency,
    Ergebnis: RESULT_LABELS[t.result],
    Tags: t.tags.map((x) => x.name).join(", "),
  }));
  const fields = [
    "ID",
    "Datum",
    "Symbol",
    "Richtung",
    "Setup",
    "Session",
    "Einstieg",
    "Ausstieg",
    "Menge",
    "R",
    "Netto P&L",
    "Währung",
    "Ergebnis",
    "Tags",
  ];
  const csv = Papa.unparse(
    { fields, data: rows.map((r) => fields.map((f) => r[f as keyof typeof r])) },
    { delimiter: ";", newline: "\r\n" },
  );
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pulse-trades-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
