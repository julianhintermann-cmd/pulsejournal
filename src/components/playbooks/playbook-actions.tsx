"use client";

import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PlaybookFormDialog, type EditablePlaybook } from "@/components/playbooks/playbook-form-dialog";
import { Button } from "@/components/ui/button";
import { deletePlaybook, setPlaybookArchived } from "@/server/actions/playbooks";

export function PlaybookActions({ playbook, archived }: { playbook: EditablePlaybook; archived: boolean }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const archive = () =>
    startTransition(async () => {
      const result = await setPlaybookArchived(playbook.id, !archived);
      if (result.ok) toast.success(archived ? "Playbook wiederhergestellt" : "Playbook archiviert");
      else toast.error(result.error);
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deletePlaybook(playbook.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Playbook gelöscht");
      router.push("/playbooks");
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => setEditOpen(true)}>
        <Pencil /> Bearbeiten
      </Button>
      <Button size="sm" variant="secondary" onClick={archive} disabled={pending}>
        {archived ? <ArchiveRestore /> : <Archive />}
        {archived ? "Wiederherstellen" : "Archivieren"}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className="text-loss"
        onClick={() => setDeleteOpen(true)}
        disabled={pending}
      >
        <Trash2 /> Löschen
      </Button>
      <PlaybookFormDialog open={editOpen} onOpenChange={setEditOpen} playbook={playbook} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`„${playbook.name}“ löschen?`}
        description="Die zugehörigen Trades bleiben erhalten, verlieren aber ihr Setup und die Checkliste."
        confirmLabel="Löschen"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </div>
  );
}
