"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { closingSide, isOpeningSide, openingSide } from "@/lib/calc/trade";
import { utcToZonedInput } from "@/lib/dates";
import type { Direction } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import type { TradeFormValues } from "@/lib/validation";

import { executionLabels } from "./payload";

export function ExecutionsEditor({
  control,
  register,
  errors,
  direction,
  timeZone,
  calcError,
}: {
  control: Control<TradeFormValues>;
  register: UseFormRegister<TradeFormValues>;
  errors: FieldErrors<TradeFormValues>;
  direction: Direction;
  timeZone: string;
  calcError?: string | null;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "executions" });
  const rows = useWatch({ control, name: "executions" }) ?? [];
  const labels = executionLabels(rows, direction);
  const listError =
    (errors.executions as { message?: string } | undefined)?.message ??
    (errors.executions?.root?.message as string | undefined);

  const add = (kind: "open" | "close") => {
    const last = rows[rows.length - 1];
    append({
      side: kind === "open" ? openingSide(direction) : closingSide(direction),
      qty: "",
      price: "",
      fee: "",
      executedAt: utcToZonedInput(Date.now(), timeZone) || last?.executedAt || "",
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {fields.map((field, index) => {
          const opening = isOpeningSide(direction, rows[index]?.side ?? field.side);
          const rowErrors = errors.executions?.[index];
          return (
            <li key={field.id} className="rounded-[12px] border border-border bg-surface-2/60 p-3">
              <div className="mb-2.5 flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold",
                    opening ? "bg-accent-soft text-accent" : "bg-surface-3 text-foreground",
                  )}
                >
                  {opening ? <Plus className="size-3" strokeWidth={3} /> : <Minus className="size-3" strokeWidth={3} />}
                  {labels[index]}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Ausführung entfernen"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-[1.6fr_1fr_1fr_0.8fr]">
                <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
                  <label htmlFor={`exec-${index}-at`} className="text-small text-muted-foreground">
                    Datum/Zeit
                  </label>
                  <Input
                    id={`exec-${index}-at`}
                    type="datetime-local"
                    aria-invalid={!!rowErrors?.executedAt}
                    {...register(`executions.${index}.executedAt`)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`exec-${index}-price`} className="text-small text-muted-foreground">
                    Preis
                  </label>
                  <Input
                    id={`exec-${index}-price`}
                    inputMode="decimal"
                    className="tabular-nums"
                    aria-invalid={!!rowErrors?.price}
                    {...register(`executions.${index}.price`)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`exec-${index}-qty`} className="text-small text-muted-foreground">
                    Menge
                  </label>
                  <Input
                    id={`exec-${index}-qty`}
                    inputMode="decimal"
                    className="tabular-nums"
                    aria-invalid={!!rowErrors?.qty}
                    {...register(`executions.${index}.qty`)}
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
                  <label htmlFor={`exec-${index}-fee`} className="text-small text-muted-foreground">
                    Gebühr
                  </label>
                  <Input
                    id={`exec-${index}-fee`}
                    inputMode="decimal"
                    placeholder="0"
                    className="tabular-nums"
                    aria-invalid={!!rowErrors?.fee}
                    {...register(`executions.${index}.fee`)}
                  />
                </div>
              </div>
              {rowErrors ? (
                <p className="mt-2 text-small text-loss" role="alert">
                  {rowErrors.executedAt?.message ??
                    rowErrors.price?.message ??
                    rowErrors.qty?.message ??
                    rowErrors.fee?.message}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {listError || calcError ? (
        <p role="alert" className="text-small text-loss">
          {calcError ?? listError}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => add("open")}>
          <Plus /> Einstieg
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => add("close")}>
          <Plus /> Ausstieg
        </Button>
      </div>
    </div>
  );
}
