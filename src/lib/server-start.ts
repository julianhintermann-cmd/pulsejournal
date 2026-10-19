import { runMigrations } from "@/lib/db/migrate";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { purgeDeletedTrades } from "@/lib/trades/save";

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
  if (env.seedDemo) {
    try {
      const { seedDemo } = await import("../../scripts/seed-demo");
      seedDemo();
    } catch (error) {
      log.error("Demo data could not be inserted", error);
    }
  }
  // Trades soft-deleted right before a restart are past their undo window now.
  await purgeDeletedTrades().catch((error) => log.error("Purging deleted trades failed", error));
}
