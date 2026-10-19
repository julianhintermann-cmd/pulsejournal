"use client";

import { Check, CircleAlert, FileSpreadsheet, Loader2, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-context";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { formatDateTime, formatDecimal, plural } from "@/lib/format";
import {
  CSV_FIELD_LABELS,
  DATE_FORMATS,
  detectDecimalSeparator,
  detectDelimiter,
  guessColumns,
  mapRows,
  parseCsv,
  type ParsedCsv,
} from "@/lib/import/csv";
import { cn } from "@/lib/utils";
import { CSV_TARGET_FIELDS, type CsvMapping } from "@/lib/validation";
import { deleteCsvMapping, importCsv, saveCsvMapping } from "@/server/actions/import";

const STEPS = ["Datei wählen", "Spalten zuordnen", "Vorschau", "Import"];
const DELIMITERS: { value: CsvMapping["delimiter"]; label: string }[] = [
  { value: ";", label: "Semikolon ;" },
  { value: ",", label: "Komma ," },
  { value: "\t", label: "Tabulator" },
  { value: "|", label: "Pipe |" },
];

type SavedMapping = { id: string; name: string; mapping: CsvMapping };

function Stepper({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-4 gap-2">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-col gap-1.5">
          <span className={cn("h-1 rounded-full", i <= step ? "bg-accent" : "bg-surface-3")} />
          <span className={cn("text-[11px] font-medium sm:text-small", i === step ? "text-foreground" : "text-faint")}>
            <span className="tabular-nums">{i + 1}.</span> <span className="hidden sm:inline">{label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function CsvImportWizard({
  savedMappings,
  accounts,
  playbooks,
  defaultAccountId,
}: {
  savedMappings: SavedMapping[];
  accounts: { id: string; name: string; currency: string }[];
  playbooks: { id: string; name: string }[];
  defaultAccountId: string | null;
}) {
  const { timeZone } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [mapping, setMapping] = useState<CsvMapping>({
    columns: {},
    delimiter: ";",
    decimalSeparator: ".",
    dateFormat: DATE_FORMATS[0],
    longValue: "Long",
    shortValue: "Short",
  });
  const [mappingName, setMappingName] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? "");
  const [playbookId, setPlaybookId] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [result, setResult] = useState<{
    total: number;
    imported: number;
    skipped: number;
    errors: { row: number; error: string }[];
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed: ParsedCsv = useMemo(
    () => (text ? parseCsv(text, mapping.delimiter) : { headers: [], rows: [] }),
    [text, mapping.delimiter],
  );
  const results = useMemo(() => (text ? mapRows(parsed, mapping, timeZone) : []), [parsed, mapping, timeZone, text]);
  const valid = results.filter((r) => r.ok).length;
  const requiredMissing = (["symbol", "direction", "openedAt", "entry", "qty"] as const).filter(
    (f) => !Object.values(mapping.columns).includes(f),
  );

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Die Datei ist grösser als 15 MB.");
      return;
    }
    const content = await file.text();
    const delimiter = detectDelimiter(content);
    const headers = parseCsv(content, delimiter).headers;
    if (headers.length === 0) {
      toast.error("Keine Spalten gefunden – ist das eine CSV-Datei?");
      return;
    }
    const decimalSeparator = detectDecimalSeparator(content, delimiter);
    setFileName(file.name);
    setText(content);
    setMapping((m) => ({ ...m, delimiter, decimalSeparator, columns: guessColumns(headers) }));
    setResult(null);
    setStep(1);
  };

  const applySaved = (id: string) => {
    const saved = savedMappings.find((s) => s.id === id);
    if (!saved) return;
    const headers = parseCsv(text, saved.mapping.delimiter).headers;
    const columns = Object.fromEntries(headers.map((h) => [h, saved.mapping.columns[h] ?? "ignore"]));
    setMapping({ ...saved.mapping, columns });
    toast.success(`Zuordnung „${saved.name}“ angewendet`);
  };

  const saveMapping = () =>
    startTransition(async () => {
      const r = await saveCsvMapping(mappingName, mapping);
      if (r.ok) {
        toast.success("Zuordnung gespeichert");
        setMappingName("");
      } else toast.error(r.error);
    });

  const runImport = () =>
    startTransition(async () => {
      const r = await importCsv({ text, fileName, mapping, accountId, playbookId: playbookId || null, skipDuplicates });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setResult(r.data);
      toast.success(`${plural(r.data.imported, "Trade", "Trades")} importiert`);
    });

  const reset = () => {
    setStep(0);
    setText("");
    setFileName("");
    setResult(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <Stepper step={step} />

      {step === 0 ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void loadFile(e.dataTransfer.files[0]);
            }}
            className="flex flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-border px-4 py-10 text-center transition-colors hover:border-accent hover:bg-accent-soft"
          >
            <FileSpreadsheet className="size-10 text-faint" strokeWidth={1.5} />
            <span className="text-h3">CSV-Datei wählen</span>
            <span className="text-small text-muted-foreground">
              oder hierher ziehen · Export deines Brokers, max. 15 MB
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            hidden
            onChange={(e) => {
              void loadFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-5">
          <p className="text-body text-muted-foreground">
            <span className="font-medium text-foreground">{fileName}</span> ·{" "}
            {plural(parsed.rows.length, "Zeile", "Zeilen")} · {plural(parsed.headers.length, "Spalte", "Spalten")}
          </p>
          {savedMappings.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <FormField label="Gespeicherte Zuordnung" htmlFor="saved-mapping" className="flex-1">
                <NativeSelect id="saved-mapping" defaultValue="" onChange={(e) => applySaved(e.target.value)}>
                  <option value="" disabled>
                    Zuordnung wählen…
                  </option>
                  {savedMappings.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <FormField label="Trennzeichen" htmlFor="csv-delimiter">
              <NativeSelect
                id="csv-delimiter"
                value={mapping.delimiter}
                onChange={(e) => {
                  const delimiter = e.target.value as CsvMapping["delimiter"];
                  setMapping((m) => ({ ...m, delimiter, columns: guessColumns(parseCsv(text, delimiter).headers) }));
                }}
              >
                {DELIMITERS.map((d) => (
                  <option key={d.label} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Dezimaltrennzeichen" htmlFor="csv-decimal">
              <NativeSelect
                id="csv-decimal"
                value={mapping.decimalSeparator}
                onChange={(e) => setMapping((m) => ({ ...m, decimalSeparator: e.target.value as "." | "," }))}
              >
                <option value=".">Punkt (1234.56)</option>
                <option value=",">Komma (1234,56)</option>
              </NativeSelect>
            </FormField>
            <FormField label="Datumsformat" htmlFor="csv-date" className="col-span-2 lg:col-span-2">
              <Input
                id="csv-date"
                list="csv-date-formats"
                value={mapping.dateFormat}
                onChange={(e) => setMapping((m) => ({ ...m, dateFormat: e.target.value }))}
              />
              <datalist id="csv-date-formats">
                {DATE_FORMATS.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Wert für Long" htmlFor="csv-long">
              <Input
                id="csv-long"
                value={mapping.longValue}
                onChange={(e) => setMapping((m) => ({ ...m, longValue: e.target.value }))}
              />
            </FormField>
            <FormField label="Wert für Short" htmlFor="csv-short">
              <Input
                id="csv-short"
                value={mapping.shortValue}
                onChange={(e) => setMapping((m) => ({ ...m, shortValue: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="flex flex-col divide-y divide-border rounded-[12px] border border-border">
            {parsed.headers.map((header) => (
              <div key={header} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{header}</p>
                  <p className="truncate text-small text-faint">
                    {parsed.rows
                      .slice(0, 3)
                      .map((r) => r[header])
                      .filter(Boolean)
                      .join(" · ") || "leer"}
                  </p>
                </div>
                <NativeSelect
                  aria-label={`Ziel für ${header}`}
                  className="sm:w-52"
                  value={mapping.columns[header] ?? "ignore"}
                  onChange={(e) =>
                    setMapping((m) => ({
                      ...m,
                      columns: { ...m.columns, [header]: e.target.value as CsvMapping["columns"][string] },
                    }))
                  }
                >
                  {[...CSV_TARGET_FIELDS, "ignore" as const].map((f) => (
                    <option key={f} value={f}>
                      {CSV_FIELD_LABELS[f]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ))}
          </div>

          {requiredMissing.length > 0 ? (
            <p className="flex items-center gap-2 text-small text-be">
              <CircleAlert className="size-4" /> Noch nicht zugeordnet:{" "}
              {requiredMissing.map((f) => CSV_FIELD_LABELS[f]).join(", ")}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <FormField label="Zuordnung speichern als…" htmlFor="mapping-name" className="flex-1">
              <Input
                id="mapping-name"
                value={mappingName}
                onChange={(e) => setMappingName(e.target.value)}
                placeholder="z. B. MT5 Export"
              />
            </FormField>
            <Button variant="secondary" onClick={saveMapping} disabled={pending || !mappingName.trim()}>
              Speichern
            </Button>
          </div>

          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={reset}>
              Andere Datei
            </Button>
            <Button onClick={() => setStep(2)} disabled={requiredMissing.length > 0}>
              Weiter zur Vorschau
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <p className="text-body">
            <span className="font-semibold text-profit">{valid}</span> von {results.length} Zeilen gültig
            {results.length - valid > 0 ? (
              <span className="text-loss"> · {results.length - valid} werden übersprungen</span>
            ) : null}
          </p>
          <div className="-mx-4 overflow-x-auto md:mx-0">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr className="text-left text-small text-muted-foreground">
                  {["#", "Status", "Symbol", "Richtung", "Eröffnet", "Einstieg", "Ausstieg", "Menge"].map((h) => (
                    <th key={h} className="h-9 border-b border-border px-3 font-medium first:pl-4 md:first:pl-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.slice(0, 20).map((r) => (
                  <tr key={r.index} className={cn(!r.ok && "bg-loss-soft")}>
                    <td className="h-10 border-b border-border px-3 text-faint tabular-nums first:pl-4 md:first:pl-0">
                      {r.index + 2}
                    </td>
                    {r.ok ? (
                      <>
                        <td className="border-b border-border px-3">
                          <Check className="size-4 text-profit" />
                        </td>
                        <td className="border-b border-border px-3 font-semibold">{r.row.symbol}</td>
                        <td className="border-b border-border px-3">{r.row.direction === "long" ? "Long" : "Short"}</td>
                        <td className="border-b border-border px-3 whitespace-nowrap tabular-nums">
                          {formatDateTime(r.row.openedAt, timeZone)}
                        </td>
                        <td className="border-b border-border px-3 tabular-nums">{formatDecimal(r.row.entry)}</td>
                        <td className="border-b border-border px-3 tabular-nums">{formatDecimal(r.row.exit)}</td>
                        <td className="border-b border-border px-3 tabular-nums">{formatDecimal(r.row.qty, 4)}</td>
                      </>
                    ) : (
                      <td colSpan={7} className="border-b border-border px-3 text-loss">
                        <span className="inline-flex items-center gap-1.5">
                          <CircleAlert className="size-4" /> {r.error}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {results.length > 20 ? (
            <p className="text-small text-faint">Vorschau der ersten 20 von {results.length} Zeilen.</p>
          ) : null}
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Zurück
            </Button>
            <Button onClick={() => setStep(3)} disabled={valid === 0}>
              Weiter
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-4">
          {result ? (
            <div className="flex flex-col gap-3 rounded-[12px] bg-surface-2 p-4">
              <p className="flex items-center gap-2 text-h3">
                <Check className="size-5 text-profit" /> Import abgeschlossen
              </p>
              <p className="text-body text-muted-foreground">
                {plural(result.imported, "Trade", "Trades")} importiert · {result.skipped} übersprungen · {result.total}{" "}
                Zeilen
              </p>
              {result.errors.length > 0 ? (
                <ul className="max-h-40 overflow-y-auto text-small text-loss">
                  {result.errors.slice(0, 50).map((e) => (
                    <li key={`${e.row}-${e.error}`}>
                      Zeile {e.row}: {e.error}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex gap-2">
                <Button onClick={reset} variant="secondary">
                  Weitere Datei importieren
                </Button>
                <Button asChild>
                  <Link href="/trades?range=all">Trades ansehen</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Zielkonto" htmlFor="import-account">
                  <NativeSelect id="import-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {a.currency}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField label="Playbook" htmlFor="import-playbook" hint="Optional">
                  <NativeSelect id="import-playbook" value={playbookId} onChange={(e) => setPlaybookId(e.target.value)}>
                    <option value="">Kein Setup</option>
                    {playbooks.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-[12px] border border-border p-3">
                <span>
                  <span className="block text-[14px] font-medium">Duplikate überspringen</span>
                  <span className="text-small text-muted-foreground">
                    Gleiches Konto, Symbol, Richtung, Zeit, Einstieg und Menge.
                  </span>
                </span>
                <Switch checked={skipDuplicates} onCheckedChange={setSkipDuplicates} />
              </label>
              <div className="flex justify-between gap-2">
                <Button variant="ghost" onClick={() => setStep(2)} disabled={pending}>
                  Zurück
                </Button>
                <Button onClick={runImport} disabled={pending || !accountId}>
                  {pending ? <Loader2 className="animate-spin" /> : <Upload />}
                  {plural(valid, "Trade", "Trades")} importieren
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {savedMappings.length > 0 && step === 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-small tracking-[0.04em] text-muted-foreground uppercase">Gespeicherte Zuordnungen</h3>
          <ul className="flex flex-col divide-y divide-border rounded-[12px] border border-border">
            {savedMappings.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-[14px]">{s.name}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${s.name} löschen`}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await deleteCsvMapping(s.id);
                      if (!r.ok) toast.error(r.error);
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
