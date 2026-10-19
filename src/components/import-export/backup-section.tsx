"use client";

import { ArchiveRestore, Download, FileArchive, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

export function BackupDownload() {
  return (
    <Button asChild className="w-fit">
      <a href="/api/export/backup.zip" download>
        <Download /> Backup herunterladen
      </a>
    </Button>
  );
}

/** Upload a backup zip, confirm with WIEDERHERSTELLEN, then the server swaps data and logs everyone out. */
export function BackupRestore() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const restore = async () => {
    if (!file) return;
    setPending(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("confirm", "WIEDERHERSTELLEN");
      const response = await fetch("/api/import/backup", { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Wiederherstellung fehlgeschlagen.");
        setPending(false);
        return;
      }
      toast.success("Backup wiederhergestellt – bitte neu anmelden");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Keine Verbindung zum Server.");
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={pending}>
          <FileArchive /> Backup-Datei wählen
        </Button>
        <span className="min-w-0 truncate text-small text-muted-foreground">
          {file ? file.name : "Keine Datei gewählt"}
        </span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <Button variant="destructive" className="w-fit" disabled={!file || pending} onClick={() => setOpen(true)}>
        {pending ? <Loader2 className="animate-spin" /> : <ArchiveRestore />}
        Backup wiederherstellen
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Backup wiederherstellen?"
        description="Alle aktuellen Daten (Datenbank und Screenshots) werden durch das Backup ersetzt. Danach musst du dich neu anmelden."
        confirmText="WIEDERHERSTELLEN"
        confirmLabel="Wiederherstellen"
        destructive
        pending={pending}
        onConfirm={() => {
          setOpen(false);
          void restore();
        }}
      />
    </div>
  );
}
