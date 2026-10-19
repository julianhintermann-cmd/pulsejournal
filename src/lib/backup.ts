import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { TZDate } from "@date-fns/tz";
import { Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough } from "fflate";

import { closeDb, databaseFile, getSqlite } from "@/lib/db/client";
import { migrationsFolder, runMigrations } from "@/lib/db/migrate";
import { appInfo, dataPath, env } from "@/lib/env";
import { log } from "@/lib/log";
import { readSettings } from "@/lib/settings";
import { uploadsRoot } from "@/lib/uploads";

export const BACKUP_NAME_RE = /^pulse-backup-\d{4}-\d{2}-\d{2}(-\d{6})?\.zip$/;

export type BackupManifest = { app: "pulse-journal"; appVersion: string; schemaVersion: number; createdAt: string };

export function backupsDir() {
  return dataPath("backups");
}

/** Number of migrations shipped with this build (the schema version written into backups). */
export async function currentSchemaVersion() {
  try {
    const journal = JSON.parse(await readFile(path.join(migrationsFolder(), "meta", "_journal.json"), "utf8")) as {
      entries: unknown[];
    };
    return journal.entries.length;
  } catch {
    return 0;
  }
}

async function listFiles(dir: string, base = dir): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full, base)));
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

function pipeFile(file: string, entry: ZipDeflate | ZipPassThrough) {
  return new Promise<void>((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on("data", (chunk) => entry.push(new Uint8Array(chunk as Buffer)));
    stream.on("end", () => {
      entry.push(new Uint8Array(0), true);
      resolve();
    });
    stream.on("error", reject);
  });
}

/**
 * Writes a full backup zip (journal.db via VACUUM INTO, the uploads folder and manifest.json) to `target`.
 * Entries are streamed so large upload folders do not need to fit into memory.
 */
export async function writeBackupZip(target: string) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pulse-backup-"));
  const snapshot = path.join(tmp, "journal.db");
  try {
    getSqlite().prepare("VACUUM INTO ?").run(snapshot);
    await mkdir(path.dirname(target), { recursive: true });
    const partial = `${target}.partial`;
    const out = createWriteStream(partial);
    const done = new Promise<void>((resolve, reject) => {
      out.on("finish", resolve);
      out.on("error", reject);
    });
    const zip = new Zip((error, chunk, final) => {
      if (error) {
        out.destroy(error);
        return;
      }
      out.write(Buffer.from(chunk));
      if (final) out.end();
    });

    const manifest: BackupManifest = {
      app: "pulse-journal",
      appVersion: appInfo.version,
      schemaVersion: await currentSchemaVersion(),
      createdAt: new Date().toISOString(),
    };
    const manifestEntry = new ZipDeflate("manifest.json", { level: 6 });
    zip.add(manifestEntry);
    manifestEntry.push(new TextEncoder().encode(JSON.stringify(manifest, null, 2)), true);

    const dbEntry = new ZipDeflate("journal.db", { level: 6 });
    zip.add(dbEntry);
    await pipeFile(snapshot, dbEntry);

    const root = uploadsRoot();
    for (const rel of await listFiles(root)) {
      if (isRestoreFolder(rel)) continue;
      const entry = new ZipPassThrough(`uploads/${rel}`);
      zip.add(entry);
      await pipeFile(path.join(root, rel), entry);
    }
    zip.end();
    await done;
    await rename(partial, target);
    return manifest;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

export class RestoreError extends Error {}

/** Extracts a backup zip into a fresh directory (streaming, with zip-slip protection). */
async function extractZip(zipFile: string, targetDir: string) {
  await mkdir(targetDir, { recursive: true });
  const writes: Promise<void>[] = [];
  const unzip = new Unzip((file) => {
    const name = file.name;
    if (name.endsWith("/")) return;
    const resolved = path.resolve(targetDir, name);
    if (!resolved.startsWith(path.resolve(targetDir) + path.sep)) {
      throw new RestoreError("Ungültiger Pfad im Backup.");
    }
    writes.push(
      (async () => {
        await mkdir(path.dirname(resolved), { recursive: true });
        await new Promise<void>((resolve, reject) => {
          const out = createWriteStream(resolved);
          out.on("finish", resolve);
          out.on("error", reject);
          file.ondata = (error, chunk, final) => {
            if (error) {
              reject(error);
              return;
            }
            out.write(Buffer.from(chunk));
            if (final) out.end();
          };
          file.start();
        });
      })(),
    );
  });
  unzip.register(UnzipInflate);
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(zipFile);
    stream.on("data", (chunk) => {
      try {
        unzip.push(new Uint8Array(chunk as Buffer));
      } catch (error) {
        stream.destroy();
        reject(error);
      }
    });
    stream.on("end", () => {
      try {
        unzip.push(new Uint8Array(0), true);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    stream.on("error", reject);
  });
  await Promise.all(writes);
}

/** Prefixes of the transient folders a restore creates inside the uploads folder. */
const RESTORE_STAGING = ".restore-";
const RESTORE_PREVIOUS = ".before-restore-";

function isRestoreFolder(name: string) {
  return name.startsWith(RESTORE_STAGING) || name.startsWith(RESTORE_PREVIOUS);
}

/** Moves the entries of `from` into `to` (both on the same file system), skipping restore folders. */
async function moveEntries(from: string, to: string) {
  await mkdir(to, { recursive: true });
  for (const name of await readdir(from)) {
    if (isRestoreFolder(name)) continue;
    await rename(path.join(from, name), path.join(to, name));
  }
}

/**
 * Restores a backup zip: validates manifest and schema version, then swaps database and uploads
 * (old files are kept until the swap succeeded) and reopens the connection with migrations applied.
 * The uploads folder itself is never renamed, only its contents, so it may be a separate mount (e.g. on another disk).
 */
export async function restoreBackup(zipFile: string) {
  const work = await mkdtemp(path.join(env.dataDir, ".restore-"));
  const uploads = uploadsRoot();
  const stamp = Date.now();
  const stagedUploads = path.join(uploads, `${RESTORE_STAGING}${stamp}`);
  const oldUploads = path.join(uploads, `${RESTORE_PREVIOUS}${stamp}`);
  try {
    await extractZip(zipFile, work);
    let manifest: BackupManifest;
    try {
      manifest = JSON.parse(await readFile(path.join(work, "manifest.json"), "utf8")) as BackupManifest;
    } catch {
      throw new RestoreError("manifest.json fehlt oder ist ungültig – ist das ein Pulse-Backup?");
    }
    if (manifest.app !== "pulse-journal" || typeof manifest.schemaVersion !== "number") {
      throw new RestoreError("Das ist kein gültiges Pulse-Journal-Backup.");
    }
    const schemaVersion = await currentSchemaVersion();
    if (manifest.schemaVersion > schemaVersion) {
      throw new RestoreError(
        `Das Backup stammt von einer neueren Version (Schema ${manifest.schemaVersion} > ${schemaVersion}). Bitte zuerst Pulse aktualisieren.`,
      );
    }
    const restoredDb = path.join(work, "journal.db");
    if (!existsSync(restoredDb) || (await stat(restoredDb)).size === 0)
      throw new RestoreError("journal.db fehlt im Backup.");

    // Copy the restored uploads onto the uploads file system first, so the swap below only needs renames there.
    await mkdir(stagedUploads, { recursive: true });
    const restoredUploads = path.join(work, "uploads");
    if (existsSync(restoredUploads)) await cp(restoredUploads, stagedUploads, { recursive: true });

    const dbFile = databaseFile();
    const oldDb = `${dbFile}.before-restore-${stamp}`;

    try {
      getSqlite().pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      // the connection may already be closed
    }
    closeDb();
    await rm(`${dbFile}-wal`, { force: true });
    await rm(`${dbFile}-shm`, { force: true });

    const hadDb = existsSync(dbFile);
    let oldUploadsMoved = false;
    try {
      if (hadDb) await rename(dbFile, oldDb);
      await moveEntries(uploads, oldUploads);
      oldUploadsMoved = true;
      await rename(restoredDb, dbFile);
      await moveEntries(stagedUploads, uploads);
      runMigrations();
    } catch (error) {
      // Roll back to the previous state.
      closeDb();
      await rm(dbFile, { force: true });
      if (hadDb) await rename(oldDb, dbFile);
      // Entries left in the uploads folder are restored files only once all old files were moved away.
      if (oldUploadsMoved) {
        for (const name of await readdir(uploads)) {
          if (!isRestoreFolder(name)) await rm(path.join(uploads, name), { recursive: true, force: true });
        }
      }
      if (existsSync(oldUploads)) await moveEntries(oldUploads, uploads);
      runMigrations();
      throw error;
    }
    await rm(oldDb, { force: true });
    await rm(oldUploads, { recursive: true, force: true });
    log.info(`Backup restored (created ${manifest.createdAt}, schema ${manifest.schemaVersion})`);
    return manifest;
  } finally {
    await rm(work, { recursive: true, force: true });
    await rm(stagedUploads, { recursive: true, force: true });
    // Only an empty leftover is removed here; old files that could not be moved back are kept.
    await rmdir(oldUploads).catch(() => undefined);
  }
}

export type BackupFile = { name: string; size: number; createdAt: number };

export async function listBackups(): Promise<BackupFile[]> {
  const dir = backupsDir();
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => BACKUP_NAME_RE.test(f));
  const out: BackupFile[] = [];
  for (const name of files) {
    const s = await stat(path.join(dir, name));
    out.push({ name, size: s.size, createdAt: s.mtimeMs });
  }
  return out.sort((a, b) => b.name.localeCompare(a.name));
}

/** Creates today's automatic backup and keeps only the newest BACKUP_KEEP_DAYS files. */
export async function runAutomaticBackup() {
  const settings = readSettings();
  const now = new TZDate(Date.now(), settings.displayTimezone);
  const name = `pulse-backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.zip`;
  await writeBackupZip(path.join(backupsDir(), name));
  const all = await listBackups();
  const daily = all.filter((b) => /^pulse-backup-\d{4}-\d{2}-\d{2}\.zip$/.test(b.name));
  for (const old of daily.slice(env.backupKeepDays)) await rm(path.join(backupsDir(), old.name), { force: true });
  log.info(`Automatic backup written: ${name}`);
  return name;
}

/** Milliseconds until the next 03:30 in the display time zone. */
export function msUntilNextBackup(now = Date.now(), timeZone = readSettings().displayTimezone) {
  const local = new TZDate(now, timeZone);
  const next = new TZDate(local.getFullYear(), local.getMonth(), local.getDate(), 3, 30, 0, timeZone);
  if (next.getTime() <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now;
}

const globalForScheduler = globalThis as unknown as { __pulseBackupTimer?: NodeJS.Timeout };

/** In-process scheduler (setTimeout chain, no cron library). */
export function startBackupScheduler() {
  if (globalForScheduler.__pulseBackupTimer) clearTimeout(globalForScheduler.__pulseBackupTimer);
  const schedule = () => {
    const delay = msUntilNextBackup();
    globalForScheduler.__pulseBackupTimer = setTimeout(async () => {
      try {
        await runAutomaticBackup();
      } catch (error) {
        log.error("Automatic backup failed", error);
      }
      schedule();
    }, delay);
    globalForScheduler.__pulseBackupTimer.unref?.();
    log.debug(`Next automatic backup in ${Math.round(delay / 60000)} min`);
  };
  schedule();
}

export async function writeTempFile(data: ArrayBuffer | Uint8Array, prefix: string) {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const file = path.join(dir, "upload.zip");
  await writeFile(file, data instanceof Uint8Array ? data : new Uint8Array(data));
  return { file, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
