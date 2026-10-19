import { CircleAlert, Download, FileDown } from "lucide-react";
import type { Metadata } from "next";

import { BackupDownload, BackupRestore } from "@/components/import-export/backup-section";
import { CsvImportWizard } from "@/components/import-export/csv-import-wizard";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { listBackups } from "@/lib/backup";
import { getDb } from "@/lib/db/client";
import { listAccounts, listPlaybooksWithRules } from "@/lib/db/queries";
import { csvMappings, importLog } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { filterToQuery } from "@/lib/filter";
import { getFilter, type SearchParams } from "@/lib/filter-server";
import { formatDateTime, plural } from "@/lib/format";
import { log } from "@/lib/log";
import { getSettings } from "@/lib/settings";
import { formatBytes } from "@/lib/storage-info";
import { csvMappingSchema } from "@/lib/validation";
import { desc } from "drizzle-orm";

export const metadata: Metadata = { title: "Import/Export" };

export default async function ImportExportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const settings = getSettings();
  const tz = settings.displayTimezone;
  const filter = await getFilter(await searchParams);
  const accounts = listAccounts();
  const db = getDb();
  const saved = db
    .select()
    .from(csvMappings)
    .orderBy(desc(csvMappings.createdAt))
    .all()
    .flatMap((m) => {
      try {
        const parsed = csvMappingSchema.safeParse(JSON.parse(m.mappingJson));
        return parsed.success ? [{ id: m.id, name: m.name, mapping: parsed.data }] : [];
      } catch {
        return [];
      }
    });
  const logs = db.select().from(importLog).orderBy(desc(importLog.createdAt)).limit(10).all();
  // An unreadable backups folder (e.g. NAS share permissions) must not take down the whole page.
  const backups = await listBackups().catch((error: unknown) => {
    log.error("Backups folder could not be read", error);
    return null;
  });
  const accountName = filter.accountId ? accounts.find((a) => a.id === filter.accountId)?.name : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3 md:gap-4">
      <SettingsSection
        id="csv-import"
        title="CSV-Import"
        description="Trades aus dem Export deines Brokers übernehmen."
      >
        {accounts.length === 0 ? (
          <p className="text-body text-muted-foreground">Lege zuerst ein Konto an.</p>
        ) : (
          <CsvImportWizard
            savedMappings={saved}
            accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
            playbooks={listPlaybooksWithRules().map((p) => ({ id: p.id, name: p.name }))}
            defaultAccountId={settings.defaultAccountId}
          />
        )}
      </SettingsSection>

      <SettingsSection
        id="csv-export"
        title="CSV-Export"
        description="Alle Trades im aktuellen Filter als CSV (UTF-8, Semikolon)."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body text-muted-foreground">
            Zeitraum: <span className="font-medium text-foreground">{filter.label}</span> ·{" "}
            {accountName ?? "Alle Konten"}
          </p>
          <Button asChild variant="secondary">
            <a href={`/api/export/trades.csv?${filterToQuery(filter)}`} download>
              <FileDown /> CSV exportieren
            </a>
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        id="backup"
        title="Backup"
        description="Vollständige Sicherung: Datenbank, Screenshots und Manifest als ZIP-Datei."
      >
        <div className="flex flex-col gap-6">
          <BackupDownload />
          <div className="flex flex-col gap-2">
            <h3 className="text-h3">Automatische Backups</h3>
            <p className="text-small text-muted-foreground">
              Täglich um 03:30 ({tz}); die letzten {env.backupKeepDays} werden aufbewahrt.
            </p>
            {backups === null ? (
              <p className="flex items-start gap-2 text-body text-loss">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                Der Backup-Ordner ist nicht lesbar. Prüfe die Ordnerrechte von /data/backups auf dem Server.
              </p>
            ) : backups.length === 0 ? (
              <p className="text-body text-muted-foreground">Noch keine automatischen Backups vorhanden.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-[12px] border border-border">
                {backups.map((b) => (
                  <li key={b.name} className="flex items-center gap-3 px-3 py-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-medium">{b.name}</span>
                      <span className="text-small text-muted-foreground">
                        {formatDateTime(b.createdAt, tz)} · {formatBytes(b.size)}
                      </span>
                    </span>
                    <Button asChild variant="ghost" size="icon-sm" aria-label={`${b.name} herunterladen`}>
                      <a href={`/api/export/backup.zip?file=${encodeURIComponent(b.name)}`} download>
                        <Download />
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        id="restore"
        title="Backup wiederherstellen"
        description="Ersetzt alle Daten durch ein Pulse-Backup."
      >
        <BackupRestore />
      </SettingsSection>

      {logs.length > 0 ? (
        <SettingsSection id="history" title="Import-Verlauf">
          <ul className="flex flex-col divide-y divide-border">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[14px] font-medium">{l.fileName}</span>
                  <span className="text-small text-muted-foreground">
                    {l.source === "csv" ? "CSV" : "Backup"} · {formatDateTime(l.createdAt, tz)}
                  </span>
                </span>
                <span className="text-small text-muted-foreground tabular-nums">
                  {l.source === "csv"
                    ? `${plural(l.rowsImported, "Trade", "Trades")} · ${l.rowsSkipped} übersprungen`
                    : "Wiederhergestellt"}
                </span>
              </li>
            ))}
          </ul>
        </SettingsSection>
      ) : null}
    </div>
  );
}
