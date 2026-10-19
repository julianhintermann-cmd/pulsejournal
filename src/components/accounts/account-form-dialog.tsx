"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { ColorPicker } from "@/components/color-picker";
import { FormField } from "@/components/form-field";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ACCOUNT_TYPES, type Account } from "@/lib/db/schema";
import { ACCOUNT_TYPE_LABELS } from "@/lib/labels";
import { accountFormSchema, PALETTE, toNumber, type AccountFormValues } from "@/lib/validation";
import { createAccount, updateAccount } from "@/server/actions/accounts";

function defaults(account: Account | null, baseCurrency: string): AccountFormValues {
  return {
    name: account?.name ?? "",
    broker: account?.broker ?? "",
    type: account?.type ?? "live",
    currency: account?.currency ?? baseCurrency,
    startingBalance: account ? String(account.startingBalance) : "",
    color: account?.color ?? PALETTE[0],
  };
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  baseCurrency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  baseCurrency: string;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: defaults(account, baseCurrency),
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (open) form.reset(defaults(account, baseCurrency));
  }, [open, account, baseCurrency, form]);

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      name: values.name,
      broker: values.broker,
      type: values.type,
      currency: values.currency,
      startingBalance: toNumber(values.startingBalance) ?? 0,
      color: values.color,
    };
    startTransition(async () => {
      const result = account ? await updateAccount(account.id, payload) : await createAccount(payload);
      if (!result.ok) {
        toast.error(result.error);
        for (const [key, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(key as keyof AccountFormValues, { message });
        }
        return;
      }
      toast.success(account ? "Konto gespeichert" : "Konto angelegt");
      onOpenChange(false);
    });
  });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={account ? "Konto bearbeiten" : "Neues Konto"}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Speichern
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-1" noValidate>
        <FormField label="Name" htmlFor="account-name" error={errors.name?.message}>
          <Input id="account-name" aria-invalid={!!errors.name} {...form.register("name")} />
        </FormField>
        <FormField label="Broker" htmlFor="account-broker" hint="Optional">
          <Input id="account-broker" {...form.register("broker")} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Typ" htmlFor="account-type">
            <NativeSelect id="account-type" {...form.register("type")}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Währung" htmlFor="account-currency" error={errors.currency?.message}>
            <Input
              id="account-currency"
              maxLength={3}
              autoCapitalize="characters"
              className="uppercase"
              aria-invalid={!!errors.currency}
              {...form.register("currency")}
            />
          </FormField>
        </div>
        <FormField label="Startkapital" htmlFor="account-balance" error={errors.startingBalance?.message}>
          <Input
            id="account-balance"
            inputMode="decimal"
            className="tabular-nums"
            aria-invalid={!!errors.startingBalance}
            {...form.register("startingBalance")}
          />
        </FormField>
        <FormField label="Farbe">
          <Controller
            control={form.control}
            name="color"
            render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
          />
        </FormField>
        <button type="submit" hidden />
      </form>
    </ResponsiveDialog>
  );
}
