import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { getApiUser, unauthorized } from "@/lib/auth/guard";
import { BACKUP_NAME_RE, backupsDir, writeBackupZip } from "@/lib/backup";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

function fileResponse(file: string, name: string, size: number, onDone?: () => void) {
  const stream = createReadStream(file);
  if (onDone) {
    stream.on("close", onDone);
  }
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** GET → fresh backup; GET ?file=pulse-backup-YYYY-MM-DD.zip → download a stored automatic backup. */
export async function GET(request: Request) {
  if (!(await getApiUser())) return unauthorized();
  const url = new URL(request.url);
  const stored = url.searchParams.get("file");
  if (stored) {
    if (!BACKUP_NAME_RE.test(stored)) return new Response("Not found", { status: 404 });
    const file = path.join(backupsDir(), stored);
    try {
      const s = await stat(file);
      return fileResponse(file, stored, s.size);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const name = `pulse-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.zip`;
  const dir = await mkdtemp(path.join(os.tmpdir(), "pulse-download-"));
  const file = path.join(dir, name);
  try {
    await writeBackupZip(file);
    const s = await stat(file);
    return fileResponse(file, name, s.size, () => void rm(dir, { recursive: true, force: true }));
  } catch (error) {
    log.error("Backup download failed", error);
    await rm(dir, { recursive: true, force: true });
    return Response.json({ error: "Backup konnte nicht erstellt werden." }, { status: 500 });
  }
}
