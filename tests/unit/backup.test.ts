import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { restoreBackup, writeBackupZip } from "@/lib/backup";
import { closeDb, getSqlite } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";

const dataDir = mkdtempSync(path.join(os.tmpdir(), "pulse-backup-test-"));
const uploads = path.join(dataDir, "uploads");
const previousDataDir = process.env.DATA_DIR;

function tagNames() {
  return (getSqlite().prepare("SELECT name FROM tags ORDER BY name").all() as { name: string }[]).map((r) => r.name);
}

beforeAll(() => {
  process.env.DATA_DIR = dataDir;
  runMigrations();
});

afterAll(() => {
  closeDb();
  process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
});

describe("backup restore", () => {
  it("restores database and uploads without replacing the uploads folder itself", async () => {
    getSqlite().prepare("INSERT INTO tags (id, name) VALUES ('t1', 'vor-backup')").run();
    mkdirSync(path.join(uploads, "trades", "1"), { recursive: true });
    writeFileSync(path.join(uploads, "trades", "1", "a.webp"), "backup-file");

    const zip = path.join(dataDir, "test-backup.zip");
    await writeBackupZip(zip);

    // Changes after the backup must disappear with the restore.
    getSqlite().prepare("INSERT INTO tags (id, name) VALUES ('t2', 'nach-backup')").run();
    writeFileSync(path.join(uploads, "trades", "1", "a.webp"), "changed");
    writeFileSync(path.join(uploads, "new.webp"), "new");
    // The uploads folder may be a separate mount, so its inode has to stay the same.
    const inodeBefore = statSync(uploads).ino;

    await restoreBackup(zip);

    expect(tagNames()).toEqual(["vor-backup"]);
    expect(statSync(uploads).ino).toBe(inodeBefore);
    expect(readFileSync(path.join(uploads, "trades", "1", "a.webp"), "utf8")).toBe("backup-file");
    expect(existsSync(path.join(uploads, "new.webp"))).toBe(false);
    expect(readdirSync(uploads)).toEqual(["trades"]);
    expect(readdirSync(dataDir).filter((name) => name.includes("restore"))).toEqual([]);
  });
});
