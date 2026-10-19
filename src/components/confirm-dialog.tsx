"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** When set, the user must type this word before confirming. */
  confirmText?: string;
  pending?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  destructive,
  confirmText,
  pending,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const blocked = confirmText ? typed.trim() !== confirmText : false;

  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped("");
    onOpenChange(next);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={blocked || pending}
            autoFocus={!confirmText}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    >
      {confirmText ? (
        <div className="flex flex-col gap-2 pb-1">
          <label htmlFor="confirm-text" className="text-small text-muted-foreground">
            Zur Bestätigung <span className="font-semibold text-foreground">{confirmText}</span> eingeben
          </label>
          <Input
            id="confirm-text"
            autoComplete="off"
            autoCapitalize="characters"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
      ) : null}
    </ResponsiveDialog>
  );
}
