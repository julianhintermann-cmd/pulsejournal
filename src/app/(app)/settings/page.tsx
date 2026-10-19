import type { Metadata } from "next";

import { AboutSettings } from "@/components/settings/about-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { GeneralSettings } from "@/components/settings/general-settings";
import { InstrumentsManager } from "@/components/settings/instruments-manager";
import { ListManager } from "@/components/settings/list-manager";
import { SecuritySettings } from "@/components/settings/security-settings";
import { SessionsSettings } from "@/components/settings/sessions-settings";
import { SettingsSection } from "@/components/settings/settings-section";
import { requireUser } from "@/lib/auth/guard";
import { countOtherSessions } from "@/lib/auth/session";
import { listAccounts, listEmotions, listInstruments, listMistakes, listTags } from "@/lib/db/queries";
import { appInfo } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { formatBytes, storageInfo } from "@/lib/storage-info";
import { timeZoneOptions } from "@/lib/timezones";

export const metadata: Metadata = { title: "Einstellungen" };

const SECTIONS = [
  { id: "allgemein", label: "Allgemein" },
  { id: "darstellung", label: "Darstellung" },
  { id: "sessions", label: "Sessions" },
  { id: "listen", label: "Listen" },
  { id: "sicherheit", label: "Sicherheit" },
  { id: "ueber", label: "Über" },
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ instrument?: string }> }) {
  const user = await requireUser();
  const { instrument } = await searchParams;
  const settings = getSettings();
  const accounts = listAccounts();
  const storage = await storageInfo();
  const otherSessions = countOtherSessions(user.id, user.sessionId);
  const buildDate = appInfo.buildDate ? Date.parse(appInfo.buildDate) : NaN;

  return (
    <div className="mx-auto flex max-w-5xl gap-8">
      <nav aria-label="Abschnitte" className="sticky top-24 hidden h-fit w-44 shrink-0 flex-col gap-0.5 lg:flex">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-[8px] px-3 py-2 text-[14px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {s.label}
          </a>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-3 md:gap-4">
        <SettingsSection id="allgemein" title="Allgemein">
          <GeneralSettings
            accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
            timeZones={timeZoneOptions()}
            initial={{
              baseCurrency: (["CHF", "EUR", "USD", "GBP"].includes(settings.baseCurrency)
                ? settings.baseCurrency
                : "CHF") as "CHF" | "EUR" | "USD" | "GBP",
              displayTimezone: settings.displayTimezone,
              weekStartsOn: String(settings.weekStartsOn) as "0" | "1" | "6",
              beThreshold: String(settings.beThreshold),
              defaultAccountId: settings.defaultAccountId ?? "",
              defaultRiskPercent: String(settings.defaultRiskPercent),
            }}
          />
        </SettingsSection>
        <SettingsSection id="darstellung" title="Darstellung">
          <AppearanceSettings theme={settings.theme} compactTables={settings.compactTables} />
        </SettingsSection>
        <SettingsSection id="sessions" title="Sessions" description="Zeitfenster für die Session-Auswertung.">
          <SessionsSettings initial={settings.sessions} />
        </SettingsSection>
        <SettingsSection id="listen" title="Listen" description="Tags, Fehler, Emotionen und Instrumente verwalten.">
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="text-h3">Tags</h3>
              <ListManager kind="tags" items={listTags()} placeholder="Neuer Tag" />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-h3">Fehler</h3>
              <ListManager kind="mistakes" items={listMistakes()} placeholder="Neuer Fehler" reorderable />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-h3">Emotionen</h3>
              <ListManager kind="emotions" items={listEmotions()} placeholder="Neue Emotion" reorderable />
            </div>
            <div id="instrumente" className="flex scroll-mt-24 flex-col gap-3">
              <h3 className="text-h3">Instrumente</h3>
              <InstrumentsManager
                items={listInstruments()}
                baseCurrency={settings.baseCurrency}
                initialEditId={instrument ?? null}
              />
            </div>
          </div>
        </SettingsSection>
        <SettingsSection id="sicherheit" title="Sicherheit">
          <SecuritySettings otherSessions={otherSessions} />
        </SettingsSection>
        <SettingsSection id="ueber" title="Über">
          <AboutSettings
            repoUrl={appInfo.repoUrl}
            rows={[
              { label: "Version", value: appInfo.version },
              {
                label: "Build-Datum",
                value: Number.isFinite(buildDate) ? formatDateTime(buildDate, settings.displayTimezone) : "–",
              },
              { label: "Git-Commit", value: appInfo.gitSha.slice(0, 12) },
              { label: "Datenbank", value: formatBytes(storage.dbSize) },
              { label: "Uploads", value: formatBytes(storage.uploadsSize) },
              { label: "Angemeldet als", value: user.username },
            ]}
          />
        </SettingsSection>
      </div>
    </div>
  );
}
