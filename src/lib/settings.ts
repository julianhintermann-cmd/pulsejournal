import { eq } from "drizzle-orm";
import { cache } from "react";

import { getDb } from "@/lib/db/client";
import { settings, type Settings } from "@/lib/db/schema";
import { parseSessionsJson, type SessionsConfig } from "@/lib/sessions";

export type AppSettings = Omit<Settings, "sessionsJson"> & { sessions: SessionsConfig };

const DEFAULTS: Settings = {
  id: 1,
  baseCurrency: "CHF",
  displayTimezone: "Europe/Zurich",
  theme: "dark",
  beThreshold: 0,
  weekStartsOn: 1,
  defaultAccountId: null,
  defaultRiskPercent: 1,
  sessionsJson: "",
  compactTables: false,
};

export function readSettings(): AppSettings {
  const row = getDb().select().from(settings).where(eq(settings.id, 1)).get() ?? DEFAULTS;
  const { sessionsJson, ...rest } = row;
  return { ...rest, sessions: parseSessionsJson(sessionsJson) };
}

/** Settings of the current request (memoised). */
export const getSettings = cache(readSettings);
