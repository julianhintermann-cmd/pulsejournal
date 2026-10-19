import { getDb } from "@/lib/db/client";
import { emotions, mistakes, settings } from "@/lib/db/schema";

export const DEFAULT_MISTAKES = [
  "FOMO-Einstieg",
  "Zu früh eingestiegen",
  "Zu spät eingestiegen",
  "Stop Loss verschoben",
  "Kein Stop Loss",
  "Zu grosse Position",
  "Revenge-Trade",
  "Gegen den Trend",
  "Plan nicht befolgt",
  "Gewinn zu früh mitgenommen",
  "Overtrading",
  "News ignoriert",
];

export const DEFAULT_EMOTIONS = [
  "Ruhig",
  "Fokussiert",
  "Zuversichtlich",
  "Ungeduldig",
  "Gestresst",
  "Ängstlich",
  "Gierig",
  "Frustriert",
  "Müde",
  "Euphorisch",
];

/**
 * Inserts the settings row on a fresh database together with the default mistake and emotion lists.
 * Runs only once: when the settings row already exists, user edits to the lists are left untouched.
 */
export function seedDefaults() {
  const db = getDb();
  db.transaction((tx) => {
    const inserted = tx.insert(settings).values({ id: 1 }).onConflictDoNothing().run();
    if (inserted.changes === 0) return;
    tx.insert(mistakes)
      .values(DEFAULT_MISTAKES.map((name, position) => ({ name, position })))
      .onConflictDoNothing()
      .run();
    tx.insert(emotions)
      .values(DEFAULT_EMOTIONS.map((name, position) => ({ name, position })))
      .onConflictDoNothing()
      .run();
  });
}
