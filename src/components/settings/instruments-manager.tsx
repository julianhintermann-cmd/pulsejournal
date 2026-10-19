"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { InstrumentItem } from "@/lib/db/queries";
import { ASSET_CLASSES } from "@/lib/db/schema";
import { formatDecimal } from "@/lib/format";
import { ASSET_CLASS_LABELS } from "@/lib/labels";
import { instrumentFormSchema, toNumber, type InstrumentFormValues } from "@/lib/validation";
import { deleteInstrument, saveInstrument } from "@/server/actions/lists";

function toValues(item: InstrumentItem | null, baseCurrency: string): InstrumentFormValues {
  return {
    symbol: item?.symbol ?? "",
    assetClass: item?.assetClass ?? "other",
    multiplier: item ? String(item.multiplier) : "1",
    quoteCurrency: item?.quoteCurrency ?? baseCurrency,
    tickSize: item?.tickSize != null ? String(item.tickSize) : "",
  };
}

export function InstrumentDialog({
  open,
  onOpenChange,
  item,
  baseCurrency,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InstrumentItem | null;
  baseCurrency: string;
  onSaved?: (saved: { id: string; symbol: string; multiplier: number; quoteCurrency: string }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<InstrumentFormValues>({
    resolver: zodResolver(instrumentFormSchema),
    defaultValues: toValues(item, baseCurrency),
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (open) form.reset(toValues(item, baseCurrency));
  }, [open, item, baseCurrency, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveInstrument(item?.id ?? null, {
        symbol: values.symbol,
        assetClass: values.assetClass,
        multiplier: toNumber(values.multiplier),
        quoteCurrency: values.quoteCurrency,
        tickSize: toNumber(values.tickSize),
      });
      if (!result.ok) {
        toast.error(result.error);
        for (const [key, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(key as keyof InstrumentFormValues, { message });
        }
        return;
      }
      toast.success("Instrument gespeichert");
      onSaved?.({
        id: result.data.id,
        symbol: values.symbol.trim().toUpperCase(),
        multiplier: toNumber(values.multiplier) ?? 1,
        quoteCurrency: values.quoteCurrency.trim().toUpperCase(),
      });
      onOpenChange(false);
    });
  });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? `${item.symbol} bearbeiten` : "Neues Instrument"}
      description="Der Multiplikator ist der Geldwert pro 1.0 Preisbewegung pro 1 Einheit Menge."
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
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4 pb-1" noValidate>
        <FormField
          label="Symbol"
          htmlFor="ins-symbol"
          error={errors.symbol?.message}
          className="col-span-2 sm:col-span-1"
        >
          <Input id="ins-symbol" className="uppercase" autoCapitalize="characters" {...form.register("symbol")} />
        </FormField>
        <FormField label="Anlageklasse" htmlFor="ins-class" className="col-span-2 sm:col-span-1">
          <NativeSelect id="ins-class" {...form.register("assetClass")}>
            {ASSET_CLASSES.map((c) => (
              <option key={c} value={c}>
                {ASSET_CLASS_LABELS[c]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Multiplikator" htmlFor="ins-mult" error={errors.multiplier?.message}>
          <Input id="ins-mult" inputMode="decimal" className="tabular-nums" {...form.register("multiplier")} />
        </FormField>
        <FormField label="Quote-Währung" htmlFor="ins-quote" error={errors.quoteCurrency?.message}>
          <Input id="ins-quote" maxLength={3} className="uppercase" {...form.register("quoteCurrency")} />
        </FormField>
        <FormField label="Tick-Grösse" htmlFor="ins-tick" error={errors.tickSize?.message} hint="Optional">
          <Input id="ins-tick" inputMode="decimal" className="tabular-nums" {...form.register("tickSize")} />
        </FormField>
        <button type="submit" hidden />
      </form>
    </ResponsiveDialog>
  );
}

export function InstrumentsManager({
  items,
  baseCurrency,
  initialEditId,
}: {
  items: InstrumentItem[];
  baseCurrency: string;
  initialEditId?: string | null;
}) {
  const initial = initialEditId ? (items.find((i) => i.id === initialEditId) ?? null) : null;
  const [dialogOpen, setDialogOpen] = useState(initial != null);
  const [editing, setEditing] = useState<InstrumentItem | null>(initial);
  const [deleting, setDeleting] = useState<InstrumentItem | null>(null);
  const [pending, startTransition] = useTransition();

  const confirmDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteInstrument(deleting.id);
      if (!result.ok) toast.error(result.error);
      else toast.success("Instrument gelöscht");
      setDeleting(null);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus /> Instrument
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="py-3 text-center text-small text-muted-foreground">
          Instrumente werden beim Erfassen eines Trades automatisch angelegt.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
          {items.map((item) => (
            <li key={item.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[14px] font-semibold">{item.symbol}</span>
                <span className="truncate text-small text-muted-foreground">
                  {ASSET_CLASS_LABELS[item.assetClass]} · ×{formatDecimal(item.multiplier, 6)} · {item.quoteCurrency}
                  {item.tickSize != null ? ` · Tick ${formatDecimal(item.tickSize, 8)}` : ""}
                </span>
              </div>
              <span className="shrink-0 text-small text-muted-foreground tabular-nums">{item.count} Trades</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${item.symbol} bearbeiten`}
                onClick={() => {
                  setEditing(item);
                  setDialogOpen(true);
                }}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${item.symbol} löschen`}
                disabled={item.count > 0}
                title={item.count > 0 ? `Wird von ${item.count} Trades verwendet` : undefined}
                onClick={() => setDeleting(item)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <InstrumentDialog open={dialogOpen} onOpenChange={setDialogOpen} item={editing} baseCurrency={baseCurrency} />
      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`${deleting?.symbol ?? ""} löschen?`}
        description="Das Instrument wird bei keinem Trade verwendet."
        confirmLabel="Löschen"
        destructive
        pending={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
