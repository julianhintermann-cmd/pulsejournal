import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { getApiUser, unauthorized } from "@/lib/auth/guard";
import { deleteAllSessions } from "@/lib/auth/session";
import { RestoreError, restoreBackup, writeTempFile } from "@/lib/backup";
import { getDb } from "@/lib/db/client";
import { importLog } from "@/lib/db/schema";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Multipart upload of a backup zip (field "file") with the typed confirmation (field "confirm"). */
export async function POST(request: Request) {
  if (!(await getApiUser())) return unauthorized();
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  if (form.get("confirm") !== "WIEDERHERSTELLEN") {
    return Response.json({ error: "Bitte zur Bestätigung WIEDERHERSTELLEN eingeben." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return Response.json({ error: "Keine Datei erhalten." }, { status: 400 });

  const temp = await writeTempFile(await file.arrayBuffer(), "pulse-restore-");
  try {
    const manifest = await restoreBackup(temp.file);
    // Everyone (including this browser) has to log in again against the restored database.
    deleteAllSessions();
    getDb()
      .insert(importLog)
      .values({ source: "backup", fileName: file.name.slice(0, 200), rowsTotal: 1, rowsImported: 1, rowsSkipped: 0 })
      .run();
    (await cookies()).delete(SESSION_COOKIE);
    return Response.json({ ok: true, createdAt: manifest.createdAt });
  } catch (error) {
    if (error instanceof RestoreError) return Response.json({ error: error.message }, { status: 400 });
    log.error("Restore failed", error);
    return Response.json(
      { error: "Wiederherstellung fehlgeschlagen. Die bisherigen Daten sind unverändert." },
      { status: 500 },
    );
  } finally {
    await temp.cleanup();
  }
}
