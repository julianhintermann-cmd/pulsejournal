"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useApp } from "@/components/app-context";
import { FormField } from "@/components/form-field";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { utcToZonedInput, zonedInputToUtc } from "@/lib/dates";
import { CASH_TYPES } from "@/lib/db/schema";
import { CASH_TYPE_LABELS } from "@/lib/labels";
import { cashFormSchema, toNumber, type CashFormValues } from "@/lib/validation";
import { createCashTransaction } from "@/server/actions/cash";

export function CashDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
  currency: string;
}) {
  const { timeZone } = useApp();
  const [pending, startTransition] = useTransition();
  const form = useForm<CashFormValues>({
    resolver: zodResolver(cashFormSchema),
    defaultValues: { type: "deposit", amount: "", occurredAt: "", note: "" },
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (open) form.reset({ type: "deposit", amount: "", occurredAt: utcToZonedInput(Date.now(), timeZone), note: "" });
  }, [open, form, timeZone]);

  const onSubmit = form.handleSubmit((values) => {
    const occurredAt = zonedInputToUtc(values.occurredAt, timeZone);
    if (occurredAt == null) {
      form.setError("occurredAt", { message: "Bitte ein gültiges Datum eingeben." });
      return;
    }
    startTransition(async () => {
      const result = await createCashTransaction({
        accountId,
        type: values.type,
        amount: toNumber(values.amount),
        occurredAt,
        note: values.note,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${CASH_TYPE_LABELS[values.type]} erfasst`);
      onOpenChange(false);
    });
  });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ein-/Auszahlung erfassen"
      description={accountName}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? <Spinner /> : null}
            Speichern
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-1" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Typ" htmlFor="cash-type">
            <NativeSelect id="cash-type" {...form.register("type")}>
              {CASH_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CASH_TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={`Betrag (${currency})`} htmlFor="cash-amount" error={errors.amount?.message}>
            <Input
              id="cash-amount"
              inputMode="decimal"
              className="tabular-nums"
              aria-invalid={!!errors.amount}
              {...form.register("amount")}
            />
          </FormField>
        </div>
        <FormField label="Datum" htmlFor="cash-date" error={errors.occurredAt?.message}>
          <Input
            id="cash-date"
            type="datetime-local"
            aria-invalid={!!errors.occurredAt}
            {...form.register("occurredAt")}
          />
        </FormField>
        <FormField label="Notiz" htmlFor="cash-note" hint="Optional">
          <Input id="cash-note" {...form.register("note")} />
        </FormField>
        <button type="submit" hidden />
      </form>
    </ResponsiveDialog>
  );
}
