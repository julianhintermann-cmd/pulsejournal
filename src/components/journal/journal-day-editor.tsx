"use client";

import { useEffect, useRef, useState } from "react";

import { AutosaveIndicator, type AutosaveState } from "@/components/autosave-indicator";
import { FormField } from "@/components/form-field";
import { MarkdownEditor } from "@/components/markdown-editor";
import { RatingInput } from "@/components/rating-input";
import { Input } from "@/components/ui/input";
import { MOOD_EMOJI } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { parseDecimal, type JournalDayInput } from "@/lib/validation";
import { saveJournalDay } from "@/server/actions/journal";

export type JournalDraft = Omit<JournalDayInput, "date" | "sleepHours"> & { sleepHours: string };

function MoodPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div role="radiogroup" aria-label="Stimmung" className="flex gap-1.5">
      {MOOD_EMOJI.map((emoji, i) => {
        const n = i + 1;
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Stimmung ${n} von 5`}
            onClick={() => onChange(active ? null : n)}
            className={cn(
              "flex size-11 items-center justify-center rounded-full border text-[22px] transition-all",
              active
                ? "scale-110 border-accent bg-accent-soft"
                : "border-border bg-surface-2 opacity-60 grayscale-[0.4] hover:opacity-100",
            )}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Plan befolgt?"
      className="inline-flex w-fit rounded-control border border-border bg-surface-2 p-1"
    >
      {[
        { v: true, label: "Ja" },
        { v: false, label: "Nein" },
      ].map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(value === o.v ? null : o.v)}
          className={cn(
            "h-9 min-w-16 rounded-[7px] px-4 text-[13px] font-semibold transition-colors md:h-8",
            value === o.v
              ? o.v
                ? "bg-profit-soft text-profit"
                : "bg-loss-soft text-loss"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Journal day form with autosave 1 s after the last change. */
export function JournalDayEditor({
  date,
  initial,
  tradesSection,
  screenshotsSection,
}: {
  date: string;
  initial: JournalDraft;
  tradesSection: React.ReactNode;
  screenshotsSection: React.ReactNode;
}) {
  const [draft, setDraft] = useState<JournalDraft>(initial);
  const [state, setState] = useState<AutosaveState>("idle");
  const timer = useRef<number | null>(null);
  const latest = useRef(draft);
  const savedTimer = useRef<number | null>(null);

  const save = async (value: JournalDraft) => {
    const sleep = parseDecimal(value.sleepHours);
    if (sleep != null && (Number.isNaN(sleep) || sleep < 0 || sleep > 24)) {
      setState("error");
      return;
    }
    setState("saving");
    const result = await saveJournalDay({ date, ...value, sleepHours: sleep });
    if (latest.current !== value) return; // a newer change is pending
    if (!result.ok) {
      setState("error");
      return;
    }
    setState("saved");
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 2500);
  };

  const update = (patch: Partial<JournalDraft>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);
    setState("pending");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void save(next);
    }, 1000);
  };

  useEffect(() => {
    const flush = () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
        void save(latest.current);
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (timer.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush the pending save on unmount only
  }, []);

  const sleepInvalid = (() => {
    const v = parseDecimal(draft.sleepHours);
    return v != null && (Number.isNaN(v) || v < 0 || v > 24);
  })();

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <AutosaveIndicator
        state={state}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-30 shadow-overlay md:right-8 md:bottom-6"
      />

      <section className="card flex flex-col gap-5 p-4 md:p-5">
        <h2 className="text-h2">Vor der Session</h2>
        <MarkdownEditor
          id="premarket"
          value={draft.premarketPlan}
          onChange={(premarketPlan) => update({ premarketPlan })}
          placeholder="Plan, Levels, News, maximale Anzahl Trades…"
          minRows={5}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <FormField label="Stimmung" className="sm:col-span-3 lg:col-span-1">
            <MoodPicker value={draft.mood} onChange={(mood) => update({ mood })} />
          </FormField>
          <FormField label="Schlaf in Stunden" htmlFor="sleep" error={sleepInvalid ? "Zwischen 0 und 24." : null}>
            <Input
              id="sleep"
              inputMode="decimal"
              placeholder="7.5"
              value={draft.sleepHours}
              onChange={(e) => update({ sleepHours: e.target.value })}
              className="w-32 tabular-nums"
              aria-invalid={sleepInvalid}
            />
          </FormField>
          <FormField label="Fokus">
            <RatingInput label="Fokus" variant="numbers" value={draft.focus} onChange={(focus) => update({ focus })} />
          </FormField>
        </div>
      </section>

      {tradesSection}

      <section className="card flex flex-col gap-5 p-4 md:p-5">
        <h2 className="text-h2">Nach der Session</h2>
        <FormField label="Review" htmlFor="review">
          <MarkdownEditor
            id="review"
            value={draft.review}
            onChange={(review) => update({ review })}
            placeholder="Wie lief der Tag? Was hast du gut gemacht?"
            minRows={5}
          />
        </FormField>
        <FormField label="Plan befolgt?">
          <YesNo value={draft.followedPlan} onChange={(followedPlan) => update({ followedPlan })} />
        </FormField>
        <FormField label="Lektionen" htmlFor="lessons">
          <MarkdownEditor
            id="lessons"
            value={draft.lessons}
            onChange={(lessons) => update({ lessons })}
            placeholder="Was nimmst du für morgen mit?"
            minRows={3}
          />
        </FormField>
      </section>

      {screenshotsSection}
    </div>
  );
}
