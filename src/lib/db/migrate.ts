import path from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { getDb } from "@/lib/db/client";
import { seedDefaults } from "@/lib/db/seed";
import { log } from "@/lib/log";

export function migrationsFolder() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle");
}

/** Applies pending migrations and inserts default rows. Safe to call repeatedly. */
export function runMigrations() {
  const db = getDb();
  migrate(db, { migrationsFolder: migrationsFolder() });
  seedDefaults();
  log.info("Database ready");
}
