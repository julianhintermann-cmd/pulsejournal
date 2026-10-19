"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownRight, ArrowUpRight, Info, Loader2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { ChipMultiSelect } from "@/components/chip-multi-select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { MarkdownEditor } from "@/components/markdown-editor";
import { PnlValue } from "@/components/pnl-value";
import { RatingInput } from "@/components/rating-input";
import { ResultChip } from "@/components/result-chip";
import { RValue } from "@/components/r-value";
import { filesToItems, ScreenshotUploader, type UploaderItem } from "@/components/screenshot-uploader";
import { InstrumentDialog } from "@/components/settings/instruments-manager";
import { SymbolCombobox } from "@/components/symbol-combobox";
import { TagInput } from "@/components/tag-input";
import { ExecutionsEditor } from "@/components/trade-form/executions-editor";
import {
  buildTradePayload,
  executionsFromQuick,
  formExecutions,
  isQuickCompatible,
  quickFieldsFrom,
} from "@/components/trade-form/payload";
import { SectionCard } from "@/components/trade-form/section-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  computeTrade,
  plannedRisk,
  plannedRiskReward,
  positionSize,
  validateTradeCalc,
  type TradeCalcResult,
} from "@/lib/calc/trade";
import type { FormInstrument, TradeFormData } from "@/lib/db/queries";
import { TIMEFRAMES, type Direction } from "@/lib/db/schema";
import { formatDecimal, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toNumber, tradeFormSchema, type TradeFormValues } from "@/lib/validation";
import { syncScreenshots, uploadScreenshot } from "@/server/actions/screenshots";
import { createTrade, ensureInstrument, updateTrade } from "@/server/actions/trades";

export const TRADE_MODE_COOKIE = "pulse_trade_mode";

type Props = {
  data: TradeFormData;
  timeZone: string;
  beThreshold: number;
  defaultRiskPercent: number;
  initial: TradeFormValues;
  tradeId: string | null;
  initialScreenshots: UploaderItem[];
};

function DirectionToggle({ value, onChange }: { value: Direction; onChange: (d: Direction) => void }) {
  return (
    <div role="radiogroup" aria-label="Richtung" className="grid grid-cols-2 gap-2">
      {(["long", "short"] as const).map((d) => {
        const active = value === d;
        const Icon = d === "long" ? ArrowUpRight : ArrowDownRight;
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(d)}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-control border text-[15px] font-semibold transition-colors",
              active
                ? d === "long"
                  ? "border-transparent bg-profit text-white"
                  : "border-transparent bg-loss text-white"
                : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-5" strokeWidth={2.4} />
            {d === "long" ? "Long" : "Short"}
          </button>
        );
      })}
    </div>
  );
}

function ModeToggle({
  value,
  onChange,
  quickDisabled,
}: {
  value: "quick" | "detailed";
  onChange: (mode: "quick" | "detailed") => void;
  quickDisabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="radiogroup"
        aria-label="Erfassungsmodus"
        className="inline-flex rounded-control border border-border bg-surface p-1"
      >
        {(["quick", "detailed"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            disabled={m === "quick" && quickDisabled}
            onClick={() => onChange(m)}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[7px] px-4 text-[13px] font-medium transition-colors disabled:opacity-40 md:h-8",
              value === m ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "quick" ? <Zap className="size-3.5" /> : null}
            {m === "quick" ? "Schnell" : "Detailliert"}
          </button>
        ))}
      </div>
      {quickDisabled ? (
        <p className="text-small text-faint">Mehrere Ausführungen – nur im Detailmodus bearbeitbar.</p>
      ) : null}
    </div>
  );
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "loss" }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-[12px] font-semibold tabular-nums",
        tone === "neutral" && "bg-surface-2 text-foreground",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "loss" && "bg-loss-soft text-loss",
      )}
    >
      {children}
    </span>
  );
}

export function TradeForm({
  data,
  timeZone,
  beThreshold,
  defaultRiskPercent,
  initial,
  tradeId,
  initialScreenshots,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);
  const [instruments, setInstruments] = useState<FormInstrument[]>(data.instruments);
  const [newInstrument, setNewInstrument] = useState<FormInstrument | null>(null);
  const [instrumentDialog, setInstrumentDialog] = useState(false);
  const [shots, setShots] = useState<UploaderItem[]>(initialScreenshots);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [shotsChanged, setShotsChanged] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(tradeFormSchema),
    defaultValues: initial,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { control, register, setValue, getValues, formState } = form;
  const { errors, isDirty } = formState;
  const values = useWatch({ control }) as TradeFormValues;

  const mode = values.mode;
  const direction = values.direction;
  const account = data.accounts.find((a) => a.id === values.accountId) ?? null;
  const instrument = instruments.find((i) => i.symbol === values.symbol?.trim().toUpperCase()) ?? null;
  const playbook = data.playbooks.find((p) => p.id === values.playbookId) ?? null;
  const multiplier = instrument?.multiplier ?? 1;
  const fxRate = toNumber(values.fxRate) ?? 1;
  const showFx = !!instrument && !!account && instrument.quoteCurrency !== account.currency;
  const currency = account?.currency ?? "CHF";
  const quickDisabled = !isQuickCompatible(values.executions ?? [], direction);

  // ---------- Live calculation ----------
  const live = (() => {
    const execs = formExecutions(values, timeZone);
    const input = {
      direction,
      executions: execs,
      multiplier,
      fxRate,
      fees: toNumber(values.fees) ?? 0,
      swap: toNumber(values.swap) ?? 0,
      pnlMode: values.pnlMode,
      manualNetPnl: toNumber(values.manualNetPnl),
      initialStop: toNumber(values.initialStop),
      beThreshold,
    };
    const issues = validateTradeCalc(input);
    let calc: TradeCalcResult | null = null;
    if (issues.length === 0 && execs.length > 0) calc = computeTrade(input);
    return { issues, calc, execs };
  })();

  const stopIssue = live.issues.find((i) => i.field === "initialStop")?.message ?? null;
  const qtyIssue = live.issues.find((i) => i.field === "executions")?.message ?? null;

  const entry = live.calc?.entryAvg ?? toNumber(mode === "quick" ? values.entryPrice : values.executions?.[0]?.price);
  const stop = toNumber(values.initialStop);
  const target = toNumber(values.initialTarget);
  const qtyOpened = live.calc?.qtyOpened ?? toNumber(values.qty);
  const risk = entry && stop && qtyOpened ? plannedRisk({ entry, stop, qty: qtyOpened, multiplier, fxRate }) : null;
  const riskPct = risk != null && account && account.balance > 0 ? risk / account.balance : null;
  const rr = entry && stop && target ? plannedRiskReward(entry, stop, target) : null;
  const suggestion =
    entry && stop && account && !stopIssue
      ? positionSize({
          accountBalance: account.balance,
          riskPercent: defaultRiskPercent,
          entry,
          stop,
          multiplier,
          fxRate,
        })
      : null;

  const applySuggestion = () => {
    if (suggestion == null) return;
    const qty = String(suggestion);
    if (mode === "quick") setValue("qty", qty, { shouldDirty: true });
    else {
      const rows = getValues("executions");
      const index = rows.findIndex((r) => (direction === "long" ? r.side === "buy" : r.side === "sell"));
      if (index >= 0) setValue(`executions.${index}.qty`, qty, { shouldDirty: true });
    }
  };

  // ---------- Mode / direction ----------
  const switchMode = (next: "quick" | "detailed") => {
    if (next === mode) return;
    const current = getValues();
    if (next === "detailed") {
      setValue("executions", executionsFromQuick(current, timeZone), { shouldDirty: true });
    } else {
      if (!isQuickCompatible(current.executions, current.direction)) return;
      const quick = quickFieldsFrom(current.executions, current.direction);
      for (const [key, value] of Object.entries(quick)) setValue(key as keyof typeof quick, value);
    }
    setValue("mode", next);
    document.cookie = `${TRADE_MODE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    try {
      localStorage.setItem("pulse.tradeMode", next);
    } catch {
      // ignore unavailable storage
    }
  };

  const changeDirection = (next: Direction) => {
    if (next === direction) return;
    // Keep the meaning of each execution (entry stays entry) by flipping its side.
    const rows = getValues("executions").map((r) => ({
      ...r,
      side: r.side === "buy" ? ("sell" as const) : ("buy" as const),
    }));
    setValue("executions", rows, { shouldDirty: true });
    setValue("direction", next, { shouldDirty: true });
  };

  const changePlaybook = (id: string) => {
    setValue("playbookId", id, { shouldDirty: true });
    setValue("ruleChecks", {}, { shouldDirty: true });
  };

  // ---------- Instruments ----------
  const commitSymbol = async (raw: string) => {
    const symbol = raw.trim().toUpperCase();
    if (!symbol || instruments.some((i) => i.symbol === symbol) || !values.accountId) return;
    if (!/^[A-Z0-9._/!:-]{1,30}$/.test(symbol)) return;
    const result = await ensureInstrument(symbol, values.accountId);
    if (!result.ok) return;
    const item = {
      id: result.data.id,
      symbol: result.data.symbol,
      multiplier: result.data.multiplier,
      quoteCurrency: result.data.quoteCurrency,
    };
    setInstruments((list) => (list.some((i) => i.id === item.id) ? list : [...list, item]));
    if (result.data.created) setNewInstrument(item);
  };

  // ---------- Screenshots ----------
  const updateShots = useCallback((next: UploaderItem[]) => {
    setShotsChanged(true);
    setShots(next);
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      event.preventDefault();
      const items = filesToItems(files);
      if (items.length === 0) return;
      setShotsChanged(true);
      setShots((prev) => [...prev, ...items]);
      toast.success(items.length === 1 ? "Screenshot hinzugefügt" : `${items.length} Screenshots hinzugefügt`);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  // ---------- Submit ----------
  const cancelHref = tradeId ? `/trades/${tradeId}` : "/trades";
  const dirty = isDirty || shotsChanged;

  const persistScreenshots = async (id: string) => {
    const final: { id: string; caption: string | null }[] = [];
    const pendingItems = shots.filter((s) => s.file);
    let uploaded = 0;
    for (const item of shots) {
      if (item.id) {
        final.push({ id: item.id, caption: item.caption || null });
        continue;
      }
      if (!item.file) continue;
      uploaded += 1;
      setSaving(`Screenshot ${uploaded} / ${pendingItems.length} wird hochgeladen…`);
      const fd = new FormData();
      fd.set("file", item.file);
      fd.set("tradeId", id);
      fd.set("caption", item.caption);
      const result = await uploadScreenshot(fd);
      if (result.ok) final.push({ id: result.data.id, caption: item.caption || null });
      else toast.error(result.error);
    }
    if (tradeId || final.length > 0) await syncScreenshots({ tradeId: id }, final);
  };

  const onSubmit = form.handleSubmit((formValues) => {
    if (live.issues.length > 0) {
      if (stopIssue) form.setError("initialStop", { message: stopIssue });
      if (qtyIssue) form.setError(formValues.mode === "quick" ? "qty" : "executions", { message: qtyIssue });
      return;
    }
    const payload = buildTradePayload(formValues, timeZone);
    startTransition(async () => {
      setSaving("Wird gespeichert…");
      const result = tradeId ? await updateTrade(tradeId, payload) : await createTrade(payload);
      if (!result.ok) {
        setSaving(null);
        toast.error(result.error);
        for (const [key, message] of Object.entries(result.fieldErrors ?? {})) {
          const field = key === "executions" && formValues.mode === "quick" ? "qty" : key;
          form.setError(field as FieldPath<TradeFormValues>, { message });
        }
        return;
      }
      await persistScreenshots(result.data.id);
      setShotsChanged(false);
      form.reset(formValues);
      toast.success("Trade gespeichert");
      router.push(`/trades/${result.data.id}`);
    });
  });

  const requestCancel = useCallback(() => {
    if (dirty) setDiscardOpen(true);
    else router.push(cancelHref);
  }, [dirty, router, cancelHref]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
        return;
      }
      if (e.key === "Escape" && !document.querySelector("[role=dialog]") && !e.defaultPrevented) {
        requestCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestCancel]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const checkedCount = playbook ? playbook.rules.filter((r) => values.ruleChecks?.[r.id]).length : 0;

  // ---------- Shared field blocks ----------
  const accountField = (
    <FormField label="Konto" htmlFor="accountId" error={errors.accountId?.message}>
      <NativeSelect id="accountId" aria-invalid={!!errors.accountId} {...register("accountId")}>
        {data.accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {a.currency}
          </option>
        ))}
      </NativeSelect>
    </FormField>
  );

  const symbolField = (
    <FormField
      label="Symbol"
      htmlFor="symbol"
      error={errors.symbol?.message}
      hint={
        newInstrument && newInstrument.symbol === values.symbol?.trim().toUpperCase() ? (
          <span className="flex flex-wrap items-center gap-1 text-be">
            <Info className="size-3.5" /> Neues Instrument angelegt –
            <button
              type="button"
              className="font-semibold underline underline-offset-2"
              onClick={() => setInstrumentDialog(true)}
            >
              Multiplikator prüfen
            </button>
          </span>
        ) : instrument ? (
          <span>
            Multiplikator ×{formatDecimal(instrument.multiplier, 6)} · {instrument.quoteCurrency}
          </span>
        ) : null
      }
    >
      <Controller
        control={control}
        name="symbol"
        render={({ field }) => (
          <SymbolCombobox
            id="symbol"
            value={field.value}
            onChange={field.onChange}
            onCommit={(s) => void commitSymbol(s)}
            symbols={instruments.map((i) => i.symbol)}
            recent={data.recentSymbols}
            invalid={!!errors.symbol}
          />
        )}
      />
    </FormField>
  );

  const setupField = (
    <FormField label="Setup" htmlFor="playbookId">
      <NativeSelect id="playbookId" value={values.playbookId} onChange={(e) => changePlaybook(e.target.value)}>
        <option value="">Kein Setup</option>
        {data.playbooks.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </NativeSelect>
    </FormField>
  );

  const stopField = (
    <FormField label="Stop Loss" htmlFor="initialStop" error={errors.initialStop?.message ?? stopIssue}>
      <Input
        id="initialStop"
        inputMode="decimal"
        className="tabular-nums"
        aria-invalid={!!(errors.initialStop || stopIssue)}
        {...register("initialStop")}
      />
    </FormField>
  );

  const riskChips = (
    <div className="flex flex-wrap items-center gap-2">
      {risk != null && !stopIssue ? (
        <Chip>
          Risiko: {formatMoney(risk, currency, { decimals: risk >= 100 ? 0 : 2 })}
          {riskPct != null ? ` · ${formatPercent(riskPct)}` : ""}
        </Chip>
      ) : null}
      {rr != null && !stopIssue ? <Chip tone="accent">Geplantes CRV 1 : {formatNumber(rr, 1)}</Chip> : null}
      {suggestion != null && suggestion > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pr-0.5 pl-3 text-[12px] font-semibold tabular-nums">
          Vorschlag ({formatNumber(defaultRiskPercent, 1)} %): {formatDecimal(suggestion, 2)}
          <Button type="button" size="xs" variant="default" onClick={applySuggestion} className="rounded-full">
            Übernehmen
          </Button>
        </span>
      ) : null}
    </div>
  );

  const resultCard = (
    <div className="grid grid-cols-2 gap-3 rounded-[12px] border border-border bg-surface-2/60 p-3 sm:grid-cols-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-small text-muted-foreground">Brutto</span>
        <PnlValue value={live.calc?.grossPnl} currency={currency} className="text-[15px] font-semibold" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-small text-muted-foreground">Netto</span>
        <PnlValue value={live.calc?.netPnl} currency={currency} className="text-[15px] font-semibold" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-small text-muted-foreground">R</span>
        <RValue value={live.calc?.rMultiple} className="text-[15px] font-semibold" />
      </div>
      <div className="flex flex-col items-start gap-1">
        <span className="text-small text-muted-foreground">Ergebnis</span>
        {live.calc ? <ResultChip result={live.calc.result} /> : <span className="text-[15px] text-faint">–</span>}
      </div>
    </div>
  );

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="mx-auto flex w-full max-w-3xl flex-col gap-3 md:gap-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModeToggle value={mode} onChange={switchMode} quickDisabled={quickDisabled && mode === "detailed"} />
      </div>

      {mode === "quick" ? (
        <section className="card flex flex-col gap-4 p-4 md:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {accountField}
            {symbolField}
          </div>
          <Controller
            control={control}
            name="direction"
            render={({ field }) => <DirectionToggle value={field.value} onChange={(d) => changeDirection(d)} />}
          />
          <div className="grid grid-cols-[1fr_1.35fr] gap-3">
            <FormField label="Einstieg" htmlFor="entryPrice" error={errors.entryPrice?.message}>
              <Input
                id="entryPrice"
                inputMode="decimal"
                className="tabular-nums"
                aria-invalid={!!errors.entryPrice}
                {...register("entryPrice")}
              />
            </FormField>
            <FormField label="Zeit" htmlFor="entryAt" error={errors.entryAt?.message}>
              <Input id="entryAt" type="datetime-local" aria-invalid={!!errors.entryAt} {...register("entryAt")} />
            </FormField>
            <FormField
              label="Ausstieg"
              htmlFor="exitPrice"
              error={errors.exitPrice?.message}
              hint="Leer = offener Trade"
            >
              <Input
                id="exitPrice"
                inputMode="decimal"
                className="tabular-nums"
                aria-invalid={!!errors.exitPrice}
                {...register("exitPrice")}
              />
            </FormField>
            <FormField label="Zeit" htmlFor="exitAt" error={errors.exitAt?.message}>
              <Input id="exitAt" type="datetime-local" aria-invalid={!!errors.exitAt} {...register("exitAt")} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Menge" htmlFor="qty" error={errors.qty?.message ?? qtyIssue}>
              <Input
                id="qty"
                inputMode="decimal"
                className="tabular-nums"
                aria-invalid={!!errors.qty}
                {...register("qty")}
              />
            </FormField>
            {stopField}
          </div>
          {riskChips}
          {setupField}
          {live.calc ? resultCard : null}
          {shots.length > 0 ? (
            <p className="text-small text-muted-foreground">
              {shots.length} {shots.length === 1 ? "Screenshot" : "Screenshots"} angehängt
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <SectionCard title="Basis">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {accountField}
                {symbolField}
              </div>
              <Controller
                control={control}
                name="direction"
                render={({ field }) => <DirectionToggle value={field.value} onChange={(d) => changeDirection(d)} />}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {setupField}
                <FormField label="Timeframe" htmlFor="timeframe">
                  <NativeSelect id="timeframe" {...register("timeframe")}>
                    <option value="">Kein Timeframe</option>
                    {TIMEFRAMES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Ausführungen" aside={`${values.executions?.length ?? 0}`}>
            <ExecutionsEditor
              control={control}
              register={register}
              errors={errors}
              direction={direction}
              timeZone={timeZone}
              calcError={qtyIssue}
            />
          </SectionCard>

          <SectionCard title="Risiko">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {stopField}
                <FormField label="Take Profit" htmlFor="initialTarget" error={errors.initialTarget?.message}>
                  <Input
                    id="initialTarget"
                    inputMode="decimal"
                    className="tabular-nums"
                    {...register("initialTarget")}
                  />
                </FormField>
              </div>
              {riskChips}
            </div>
          </SectionCard>

          <SectionCard title="P&L">
            <div className="flex flex-col gap-4">
              <div
                role="radiogroup"
                aria-label="P&L-Modus"
                className="inline-flex w-fit rounded-control border border-border bg-surface-2 p-1"
              >
                {(["auto", "manual"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={values.pnlMode === m}
                    onClick={() => setValue("pnlMode", m, { shouldDirty: true })}
                    className={cn(
                      "h-9 rounded-[7px] px-4 text-[13px] font-medium transition-colors md:h-8",
                      values.pnlMode === m ? "bg-surface text-foreground shadow-card" : "text-muted-foreground",
                    )}
                  >
                    {m === "auto" ? "Auto" : "Manuell"}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {values.pnlMode === "manual" ? (
                  <FormField
                    label={`Netto P&L (${currency})`}
                    htmlFor="manualNetPnl"
                    error={errors.manualNetPnl?.message}
                    className="col-span-2 sm:col-span-1"
                  >
                    <Input
                      id="manualNetPnl"
                      inputMode="decimal"
                      className="tabular-nums"
                      aria-invalid={!!errors.manualNetPnl}
                      {...register("manualNetPnl")}
                    />
                  </FormField>
                ) : null}
                {showFx ? (
                  <FormField
                    label="FX-Kurs"
                    htmlFor="fxRate"
                    error={errors.fxRate?.message}
                    hint={`1 ${instrument?.quoteCurrency} = ${values.fxRate || "x"} ${currency}`}
                  >
                    <Input id="fxRate" inputMode="decimal" className="tabular-nums" {...register("fxRate")} />
                  </FormField>
                ) : null}
                <FormField label={`Gebühren (${currency})`} htmlFor="fees" error={errors.fees?.message}>
                  <Input id="fees" inputMode="decimal" placeholder="0" className="tabular-nums" {...register("fees")} />
                </FormField>
                <FormField label={`Swap (${currency})`} htmlFor="swap" error={errors.swap?.message}>
                  <Input id="swap" inputMode="decimal" placeholder="0" className="tabular-nums" {...register("swap")} />
                </FormField>
              </div>
              {resultCard}
            </div>
          </SectionCard>

          <SectionCard
            title="Playbook-Checkliste"
            aside={playbook ? `${checkedCount} / ${playbook.rules.length} Regeln befolgt` : undefined}
          >
            {playbook ? (
              playbook.rules.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {playbook.rules.map((rule) => (
                    <li key={rule.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-2 hover:bg-surface-2">
                        <Checkbox
                          checked={!!values.ruleChecks?.[rule.id]}
                          onCheckedChange={(checked) =>
                            setValue(
                              "ruleChecks",
                              { ...getValues("ruleChecks"), [rule.id]: checked === true },
                              { shouldDirty: true },
                            )
                          }
                          className="size-5"
                        />
                        <span className="text-[14px]">{rule.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-muted-foreground">Dieses Playbook hat noch keine Regeln.</p>
              )
            ) : (
              <p className="text-body text-muted-foreground">Wähle ein Setup, um dessen Regeln abzuhaken.</p>
            )}
          </SectionCard>

          <SectionCard title="Psychologie">
            <div className="flex flex-col gap-5">
              <FormField label="Emotion vorher">
                <Controller
                  control={control}
                  name="emotionBefore"
                  render={({ field }) => (
                    <ChipMultiSelect
                      label="Emotion vorher"
                      single
                      options={data.emotions.map((e) => ({ value: e.name, label: e.name }))}
                      value={field.value ? [field.value] : []}
                      onChange={(v) => field.onChange(v[0] ?? null)}
                    />
                  )}
                />
              </FormField>
              <FormField label="Emotion nachher">
                <Controller
                  control={control}
                  name="emotionAfter"
                  render={({ field }) => (
                    <ChipMultiSelect
                      label="Emotion nachher"
                      single
                      options={data.emotions.map((e) => ({ value: e.name, label: e.name }))}
                      value={field.value ? [field.value] : []}
                      onChange={(v) => field.onChange(v[0] ?? null)}
                    />
                  )}
                />
              </FormField>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField label="Selbstvertrauen">
                  <Controller
                    control={control}
                    name="confidence"
                    render={({ field }) => (
                      <RatingInput
                        label="Selbstvertrauen"
                        variant="numbers"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </FormField>
                <FormField label="Ausführung">
                  <Controller
                    control={control}
                    name="executionRating"
                    render={({ field }) => (
                      <RatingInput label="Ausführung" value={field.value} onChange={field.onChange} />
                    )}
                  />
                </FormField>
              </div>
              <FormField label="Fehler">
                <Controller
                  control={control}
                  name="mistakeIds"
                  render={({ field }) => (
                    <ChipMultiSelect
                      label="Fehler"
                      tone="loss"
                      options={data.mistakes.map((m) => ({ value: m.id, label: m.name }))}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard title="Tags">
            <Controller
              control={control}
              name="tagNames"
              render={({ field }) => (
                <TagInput id="tags" value={field.value} onChange={field.onChange} suggestions={data.tags} />
              )}
            />
          </SectionCard>

          <SectionCard title="Screenshots" aside={shots.length > 0 ? `${shots.length}` : undefined}>
            <ScreenshotUploader items={shots} onChange={updateShots} />
          </SectionCard>

          <SectionCard title="Notizen">
            <div className="flex flex-col gap-4">
              <Controller
                control={control}
                name="notes"
                render={({ field }) => (
                  <MarkdownEditor
                    id="notes"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Was lief gut, was nicht?"
                    minRows={6}
                  />
                )}
              />
              <FormField label="TradingView-Link" htmlFor="tradingviewUrl" error={errors.tradingviewUrl?.message}>
                <Input
                  id="tradingviewUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://www.tradingview.com/x/…"
                  {...register("tradingviewUrl")}
                />
              </FormField>
            </div>
          </SectionCard>
        </>
      )}

      {/* Spacer so the fixed mobile action bar never covers content */}
      <div aria-hidden="true" className="h-16 md:hidden" />
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-bg/85 px-4 py-3 backdrop-blur-[20px] md:sticky md:bottom-0 md:-mx-8 md:mt-2 md:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-2">
          <p className="hidden min-w-0 flex-1 truncate text-small text-muted-foreground sm:block" aria-live="polite">
            {saving ?? (dirty ? "Ungespeicherte Änderungen" : "")}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={requestCancel}
            disabled={pending}
            className="flex-1 sm:flex-none"
          >
            Abbrechen
          </Button>
          <Button type="submit" disabled={pending} className="flex-1 sm:min-w-28 sm:flex-none">
            {pending ? <Loader2 className="animate-spin" /> : null}
            Speichern
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Änderungen verwerfen?"
        description="Deine Eingaben gehen verloren."
        confirmLabel="Verwerfen"
        cancelLabel="Weiter bearbeiten"
        destructive
        onConfirm={() => {
          setDiscardOpen(false);
          setShotsChanged(false);
          form.reset(initial);
          router.push(cancelHref);
        }}
      />
      {instrument ? (
        <InstrumentDialog
          open={instrumentDialog}
          onOpenChange={setInstrumentDialog}
          baseCurrency={currency}
          item={{ ...instrument, assetClass: "other", tickSize: null, createdAt: 0, count: 0 }}
          onSaved={(saved) => {
            setInstruments((list) => list.map((i) => (i.id === saved.id ? saved : i)));
            setNewInstrument(null);
          }}
        />
      ) : null}
    </form>
  );
}
