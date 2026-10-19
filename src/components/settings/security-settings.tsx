"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation";
import { changePassword, revokeOtherSessions } from "@/server/actions/auth";

export function SecuritySettings({ otherSessions }: { otherSessions: number }) {
  const [pending, startTransition] = useTransition();
  const [revokeOpen, setRevokeOpen] = useState(false);
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await changePassword(values);
      if (!result.ok) {
        toast.error(result.error);
        for (const [key, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(key as keyof ChangePasswordInput, { message });
        }
        return;
      }
      form.reset();
      toast.success("Passwort geändert");
    });
  });

  const revoke = () =>
    startTransition(async () => {
      const result = await revokeOtherSessions();
      setRevokeOpen(false);
      if (!result.ok) toast.error(result.error);
      else toast.success(`${result.data.count} Sitzungen abgemeldet`);
    });

  return (
    <div className="flex flex-col divide-y divide-border">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-6" noValidate>
        <h3 className="text-h3">Passwort ändern</h3>
        <FormField label="Aktuelles Passwort" htmlFor="currentPassword" error={errors.currentPassword?.message}>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            {...form.register("currentPassword")}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Neues Passwort" htmlFor="newPassword" error={errors.newPassword?.message}>
            <Input id="newPassword" type="password" autoComplete="new-password" {...form.register("newPassword")} />
          </FormField>
          <FormField
            label="Neues Passwort bestätigen"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...form.register("confirmPassword")}
            />
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Passwort ändern
          </Button>
        </div>
      </form>
      <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-h3">Sitzungen</h3>
          <p className="text-small text-muted-foreground">
            {otherSessions === 0
              ? "Keine weiteren aktiven Sitzungen."
              : `${otherSessions} weitere aktive ${otherSessions === 1 ? "Sitzung" : "Sitzungen"}.`}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setRevokeOpen(true)} disabled={pending || otherSessions === 0}>
          Alle anderen Sitzungen abmelden
        </Button>
      </div>
      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Alle anderen Sitzungen abmelden?"
        description="Alle anderen Geräte müssen sich danach neu anmelden."
        confirmLabel="Abmelden"
        pending={pending}
        onConfirm={revoke}
      />
    </div>
  );
}
