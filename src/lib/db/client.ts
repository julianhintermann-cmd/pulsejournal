import { mkdirSync } from "node:fs";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { dataPath, env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

type DbState = { sqlite: Database.Database; db: Db; file: string };

const globalForDb = globalThis as unknown as { __pulseDb?: DbState };

export function databaseFile() {
  return dataPath("journal.db");
}

function open(): DbState {
  mkdirSync(env.dataDir, { recursive: true });
  const file = databaseFile();
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");
  return { sqlite, db: drizzle(sqlite, { schema }), file };
}

function state(): DbState {
  const current = globalForDb.__pulseDb;
  if (current && current.file === databaseFile() && current.sqlite.open) return current;
  const next = open();
  globalForDb.__pulseDb = next;
  return next;
}

/** Drizzle instance bound to the shared connection (opened lazily). */
export function getDb(): Db {
  return state().db;
}

/** Raw better-sqlite3 connection, e.g. for VACUUM / pragma statements. */
export function getSqlite(): Database.Database {
  return state().sqlite;
}

/** Closes the shared connection; the next getDb() call reopens it (used by backup restore). */
export function closeDb() {
  const current = globalForDb.__pulseDb;
  if (current?.sqlite.open) current.sqlite.close();
  globalForDb.__pulseDb = undefined;
}
