"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { CURRENCIES, generalSettingsFormSchema, toNumber, type GeneralSettingsFormValues } from "@/lib/validation";
import { updateGeneralSettings } from "@/server/actions/settings";

export function GeneralSettings({
  initial,
  accounts,
  timeZones,
}: {
  initial: GeneralSettingsFormValues;
  accounts: { id: string; name: string }[];
  timeZones: string[];
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<GeneralSettingsFormValues>({
    resolver: zodResolver(generalSettingsFormSchema),
    defaultValues: initial,
  });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateGeneralSettings({
        baseCurrency: values.baseCurrency,
        displayTimezone: values.displayTimezone,
        weekStartsOn: Number(values.weekStartsOn),
        beThreshold: toNumber(values.beThreshold) ?? 0,
        defaultAccountId: values.defaultAccountId || null,
        defaultRiskPercent: toNumber(values.defaultRiskPercent) ?? 1,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      form.reset(values);
      toast.success("Einstellungen gespeichert");
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Basiswährung" htmlFor="baseCurrency">
          <NativeSelect id="baseCurrency" {...form.register("baseCurrency")}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Zeitzone" htmlFor="displayTimezone" hint="Für Anzeige, Kalender und Sessions.">
          <NativeSelect id="displayTimezone" {...form.register("displayTimezone")}>
            {timeZones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Wochenstart" htmlFor="weekStartsOn">
          <NativeSelect id="weekStartsOn" {...form.register("weekStartsOn")}>
            <option value="1">Montag</option>
            <option value="0">Sonntag</option>
            <option value="6">Samstag</option>
          </NativeSelect>
        </FormField>
        <FormField
          label="Break-even-Schwelle"
          htmlFor="beThreshold"
          error={errors.beThreshold?.message}
          hint="Trades mit |Netto P&L| ≤ Schwelle gelten als Break-even."
        >
          <Input id="beThreshold" inputMode="decimal" className="tabular-nums" {...form.register("beThreshold")} />
        </FormField>
        <FormField label="Standardkonto" htmlFor="defaultAccountId">
          <NativeSelect id="defaultAccountId" {...form.register("defaultAccountId")}>
            <option value="">Kein Standardkonto</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Standard-Risiko %" htmlFor="defaultRiskPercent" error={errors.defaultRiskPercent?.message}>
          <Input
            id="defaultRiskPercent"
            inputMode="decimal"
            className="tabular-nums"
            {...form.register("defaultRiskPercent")}
          />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !isDirty}>
          {pending ? <Spinner /> : null}
          Speichern
        </Button>
      </div>
    </form>
  );
}
