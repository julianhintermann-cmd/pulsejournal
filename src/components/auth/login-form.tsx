"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { FormField } from "@/components/form-field";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "@/server/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validation";

export function LoginForm({ next }: { next: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await login(values, next);
      if (result && !result.ok) setError(result.error);
    });
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-5 p-6 sm:p-8" noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Willkommen zurück</h1>
        <p className="text-body text-muted-foreground">Melde dich an, um dein Journal zu öffnen.</p>
      </div>
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
      <FormField label="Passwort" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...form.register("password")}
        />
      </FormField>
      {error ? (
        <p role="alert" className="rounded-control bg-loss-soft px-3 py-2.5 text-body text-loss">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? <Spinner /> : null}
        Anmelden
      </Button>
      <p className="text-center text-small text-muted-foreground">Du bleibst 30 Tage angemeldet.</p>
    </form>
  );
}
