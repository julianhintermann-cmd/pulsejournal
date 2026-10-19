"use client";

import { useState } from "react";

import { ActionSheet, IosAlert } from "@/components/ios/action-sheet";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/hooks/use-media-query";

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
  const phone = useMediaQuery("(max-width: 767px)");

  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped("");
    onOpenChange(next);
  };

  const typeField = confirmText ? (
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
  ) : null;

  // Phones: destructive confirmations are action sheets, others (and typed confirmations) iOS alerts.
  if (phone) {
    if (destructive && !confirmText) {
      return (
        <ActionSheet
          open={open}
          onOpenChange={handleOpenChange}
          title={title}
          message={description}
          actions={[{ label: confirmLabel, destructive: true, onSelect: onConfirm }]}
          cancelLabel={cancelLabel}
          pending={pending}
        />
      );
    }
    return (
      <IosAlert
        open={open}
        onOpenChange={handleOpenChange}
        title={title}
        message={description}
        cancelLabel={cancelLabel}
        confirmLabel={confirmLabel}
        destructive={destructive}
        confirmDisabled={blocked}
        pending={pending}
        onConfirm={onConfirm}
      >
        {typeField}
      </IosAlert>
    );
  }

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
            {pending ? <Spinner /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    >
      {typeField}
    </ResponsiveDialog>
  );
}
