import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { databaseFile } from "@/lib/db/client";
import { uploadsRoot } from "@/lib/uploads";

async function fileSize(file: string) {
  try {
    return (await stat(file)).size;
  } catch {
    return 0;
  }
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(full);
    else if (entry.isFile()) total += await fileSize(full);
  }
  return total;
}

export async function storageInfo() {
  const db = databaseFile();
  const dbSize = (await fileSize(db)) + (await fileSize(`${db}-wal`)) + (await fileSize(`${db}-shm`));
  return { dbSize, uploadsSize: await dirSize(uploadsRoot()) };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
