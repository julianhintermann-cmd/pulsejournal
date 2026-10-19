"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ACCOUNT_TYPES } from "@/lib/db/schema";
import { ACCOUNT_TYPE_LABELS } from "@/lib/labels";
import { CURRENCIES, setupFormSchema, toNumber, type SetupFormValues } from "@/lib/validation";
import { setup } from "@/server/actions/auth";

export function SetupForm({ timeZones }: { timeZones: string[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SetupFormValues>({
    resolver: zodResolver(setupFormSchema),
    defaultValues: {
      username: "",
      password: "",
      passwordConfirm: "",
      baseCurrency: "CHF",
      timezone: "Europe/Zurich",
      accountName: "",
      accountType: "live",
      accountCurrency: "CHF",
      startingBalance: "",
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await setup({
        username: values.username,
        password: values.password,
        passwordConfirm: values.passwordConfirm,
        baseCurrency: values.baseCurrency,
        timezone: values.timezone,
        account: {
          name: values.accountName,
          type: values.accountType,
          currency: values.accountCurrency,
          startingBalance: toNumber(values.startingBalance) ?? 0,
        },
      });
      if (result && !result.ok) {
        setError(result.error);
        for (const [key, message] of Object.entries(result.fieldErrors ?? {})) {
          const field = key.startsWith("account.")
            ? (
                {
                  "account.name": "accountName",
                  "account.type": "accountType",
                  "account.currency": "accountCurrency",
                  "account.startingBalance": "startingBalance",
                } as Record<string, keyof SetupFormValues>
              )[key]
            : (key as keyof SetupFormValues);
          if (field) form.setError(field, { message });
        }
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-6 p-6 sm:p-8" noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Willkommen bei Pulse</h1>
        <p className="text-body text-muted-foreground">
          Lege dein Konto an. Pulse Journal ist für genau eine Person gedacht – dich.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-small tracking-[0.04em] text-muted-foreground uppercase">Zugang</h2>
        <FormField label="Benutzername" htmlFor="username" error={errors.username?.message}>
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={!!errors.username}
            {...form.register("username")}
          />
        </FormField>
        <FormField label="Passwort" htmlFor="password" error={errors.password?.message} hint="Mindestens 10 Zeichen.">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
        </FormField>
        <FormField label="Passwort bestätigen" htmlFor="passwordConfirm" error={errors.passwordConfirm?.message}>
          <Input
            id="passwordConfirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.passwordConfirm}
            {...form.register("passwordConfirm")}
          />
        </FormField>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-small tracking-[0.04em] text-muted-foreground uppercase">Grundeinstellungen</h2>
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
          <FormField label="Zeitzone" htmlFor="timezone" error={errors.timezone?.message}>
            <NativeSelect id="timezone" {...form.register("timezone")}>
              {timeZones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-small tracking-[0.04em] text-muted-foreground uppercase">Erstes Konto</h2>
        <FormField label="Name" htmlFor="accountName" error={errors.accountName?.message}>
          <Input
            id="accountName"
            placeholder="z. B. Hauptkonto"
            aria-invalid={!!errors.accountName}
            {...form.register("accountName")}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Typ" htmlFor="accountType">
            <NativeSelect id="accountType" {...form.register("accountType")}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Währung" htmlFor="accountCurrency" error={errors.accountCurrency?.message}>
            <NativeSelect id="accountCurrency" {...form.register("accountCurrency")}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
        <FormField label="Startkapital" htmlFor="startingBalance" error={errors.startingBalance?.message}>
          <Input
            id="startingBalance"
            inputMode="decimal"
            placeholder="10’000"
            className="tabular-nums"
            aria-invalid={!!errors.startingBalance}
            {...form.register("startingBalance")}
          />
        </FormField>
      </section>

      {error ? (
        <p role="alert" className="rounded-control bg-loss-soft px-3 py-2.5 text-body text-loss">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : null}
        Einrichtung abschliessen
      </Button>
    </form>
  );
}
