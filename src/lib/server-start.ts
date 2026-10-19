import { runMigrations } from "@/lib/db/migrate";
import { log } from "@/lib/log";

const globalForStart = globalThis as unknown as { __pulseStarted?: boolean };

/** Runs once per server process (from instrumentation.ts): migrations, optional demo data, backup scheduler. */
export async function startServer() {
  if (globalForStart.__pulseStarted) return;
  globalForStart.__pulseStarted = true;
  try {
    runMigrations();
  } catch (error) {
    log.error("Database migration failed", error);
    throw error;
  }
}
