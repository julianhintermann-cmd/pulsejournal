import { z } from "zod";

import {
  ACCOUNT_TYPES,
  ASSET_CLASSES,
  CASH_TYPES,
  DIRECTIONS,
  PNL_MODES,
  SIDES,
  THEMES,
  TIMEFRAMES,
} from "@/lib/db/schema";

export const CURRENCIES = ["CHF", "EUR", "USD", "GBP"] as const;
export const PALETTE = [
  "#4F7CFF",
  "#1FD286",
  "#F5B544",
  "#FF5470",
  "#B07CFF",
  "#22C3E6",
  "#FF8A4C",
  "#9AA3B5",
] as const;

export const MSG = {
  required: "Pflichtfeld.",
  positive: "Muss grösser als 0 sein.",
  nonNegative: "Darf nicht negativ sein.",
  number: "Bitte eine gültige Zahl eingeben.",
  passwordLength: "Mindestens 10 Zeichen.",
  passwordMismatch: "Passwörter stimmen nicht überein.",
  url: "Bitte eine gültige URL eingeben.",
  date: "Bitte ein gültiges Datum eingeben.",
  currency: "Bitte einen 3-stelligen ISO-Code eingeben (z. B. CHF).",
  manualPnl: "Bitte Netto P&L eingeben.",
  executions: "Mindestens eine Einstiegs-Ausführung erfassen.",
} as const;

/**
 * Parses user-typed numbers: accepts `1’234.5`, `1'234,5`, `1234,5` and `−5`. Returns null for empty input
 * and NaN for invalid input.
 */
export function parseDecimal(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : Number.NaN;
  let s = raw
    .trim()
    .replace(/[’'\s ]/g, "")
    .replace(/−/g, "-");
  if (s === "") return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return Number.NaN;
  return Number(s);
}

const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, MSG.currency);

const optionalText = (max = 20_000) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v && v.trim() !== "" ? v : null));

const finite = z.number({ error: MSG.number }).refine(Number.isFinite, MSG.number);

const timeZone = z
  .string()
  .min(1)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unbekannte Zeitzone.");

/** Zod string that must parse as a decimal number (form fields keep raw strings). */
export function numericString(opts: { optional?: boolean; positive?: boolean; nonNegative?: boolean } = {}) {
  return z.string().superRefine((raw, ctx) => {
    const value = parseDecimal(raw);
    if (value == null) {
      if (!opts.optional) ctx.addIssue({ code: "custom", message: MSG.required });
      return;
    }
    if (Number.isNaN(value)) ctx.addIssue({ code: "custom", message: MSG.number });
    else if (opts.positive && value <= 0) ctx.addIssue({ code: "custom", message: MSG.positive });
    else if (opts.nonNegative && value < 0) ctx.addIssue({ code: "custom", message: MSG.nonNegative });
  });
}

/** Converts a validated numeric form string into a number (or null when empty). */
export function toNumber(raw: string | null | undefined): number | null {
  const value = parseDecimal(raw ?? null);
  return value == null || Number.isNaN(value) ? null : value;
}

// ---------- Auth ----------

export const loginSchema = z.object({
  username: z.string().trim().min(1, MSG.required).max(64),
  password: z.string().min(1, MSG.required).max(1024),
});
export type LoginInput = z.infer<typeof loginSchema>;

const newPassword = z.string().min(10, MSG.passwordLength).max(1024);

export const accountBaseSchema = z.object({
  name: z.string().trim().min(1, MSG.required).max(80),
  broker: optionalText(80),
  type: z.enum(ACCOUNT_TYPES),
  currency: currencyCode,
  startingBalance: finite.min(0, MSG.nonNegative),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
export type AccountInput = z.infer<typeof accountBaseSchema>;

export const setupSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Mindestens 3 Zeichen.")
      .max(64)
      .regex(/^[\p{L}\p{N}._@-]+$/u, "Nur Buchstaben, Zahlen sowie . _ - @ erlaubt."),
    password: newPassword,
    passwordConfirm: z.string(),
    baseCurrency: z.enum(CURRENCIES),
    timezone: timeZone,
    account: accountBaseSchema.omit({ color: true, broker: true }),
  })
  .refine((v) => v.password === v.passwordConfirm, { path: ["passwordConfirm"], message: MSG.passwordMismatch });
export type SetupInput = z.infer<typeof setupSchema>;

export const setupFormSchema = z
  .object({
    username: z.string(),
    password: newPassword,
    passwordConfirm: z.string(),
    baseCurrency: z.enum(CURRENCIES),
    timezone: z.string().min(1, MSG.required),
    accountName: z.string().trim().min(1, MSG.required).max(80),
    accountType: z.enum(ACCOUNT_TYPES),
    accountCurrency: currencyCode,
    startingBalance: numericString({ nonNegative: true }),
  })
  .refine((v) => v.password === v.passwordConfirm, { path: ["passwordConfirm"], message: MSG.passwordMismatch })
  .refine((v) => v.username.trim().length >= 3, { path: ["username"], message: "Mindestens 3 Zeichen." });
export type SetupFormValues = z.infer<typeof setupFormSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, MSG.required),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: MSG.passwordMismatch });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ---------- Accounts & cash ----------

export const accountSchema = accountBaseSchema;

export const cashTransactionSchema = z.object({
  accountId: z.string().min(1),
  type: z.enum(CASH_TYPES),
  amount: finite.positive(MSG.positive),
  occurredAt: z.number().int(),
  note: optionalText(500),
});
export type CashTransactionInput = z.infer<typeof cashTransactionSchema>;

// ---------- Instruments & lists ----------

export const instrumentSchema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, MSG.required)
    .max(30)
    .regex(/^[A-Z0-9._/!:-]+$/, "Nur Buchstaben, Zahlen und . _ / - : erlaubt."),
  assetClass: z.enum(ASSET_CLASSES),
  multiplier: finite.positive(MSG.positive),
  quoteCurrency: currencyCode,
  tickSize: finite.positive(MSG.positive).nullable(),
});
export type InstrumentInput = z.infer<typeof instrumentSchema>;

export const listNameSchema = z.string().trim().min(1, MSG.required).max(60);

// ---------- Playbooks ----------

export const playbookSchema = z.object({
  name: z.string().trim().min(1, MSG.required).max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  description: optionalText(20_000),
  rules: z
    .array(z.object({ id: z.string().nullable(), text: z.string().trim().min(1, MSG.required).max(300) }))
    .max(50),
});
export type PlaybookInput = z.infer<typeof playbookSchema>;

// ---------- Trades ----------

export const executionSchema = z.object({
  side: z.enum(SIDES),
  qty: finite.positive("Menge muss grösser als 0 sein."),
  price: finite.positive("Preis muss grösser als 0 sein."),
  fee: finite.min(0, MSG.nonNegative),
  executedAt: z.number().int(),
});
export type ExecutionInputData = z.infer<typeof executionSchema>;

const rating = z.number().int().min(1).max(5).nullable();

export const tradeSchema = z
  .object({
    accountId: z.string().min(1, "Bitte ein Konto wählen."),
    symbol: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, "Bitte ein Symbol eingeben.")
      .max(30)
      .regex(/^[A-Z0-9._/!:-]+$/, "Nur Buchstaben, Zahlen und . _ / - : erlaubt."),
    direction: z.enum(DIRECTIONS),
    playbookId: z.string().nullable(),
    timeframe: z.enum(TIMEFRAMES).nullable(),
    executions: z.array(executionSchema).min(1, MSG.executions).max(200),
    initialStop: finite.positive(MSG.positive).nullable(),
    initialTarget: finite.positive(MSG.positive).nullable(),
    pnlMode: z.enum(PNL_MODES),
    manualNetPnl: finite.nullable(),
    fxRate: finite.positive(MSG.positive),
    fees: finite.min(0, MSG.nonNegative),
    swap: finite,
    executionRating: rating,
    confidence: rating,
    emotionBefore: optionalText(60),
    emotionAfter: optionalText(60),
    mistakeIds: z.array(z.string()).max(100),
    tagNames: z.array(listNameSchema).max(50),
    ruleChecks: z.array(z.object({ ruleId: z.string(), checked: z.boolean() })).max(100),
    notes: optionalText(50_000),
    tradingviewUrl: z
      .string()
      .trim()
      .max(500)
      .nullish()
      .transform((v) => (v ? v : null))
      .refine((v) => v == null || /^https?:\/\/\S+$/i.test(v), MSG.url),
  })
  .superRefine((v, ctx) => {
    if (v.pnlMode === "manual" && v.manualNetPnl == null) {
      ctx.addIssue({ code: "custom", path: ["manualNetPnl"], message: MSG.manualPnl });
    }
    const opening = v.executions.filter((e) => (v.direction === "long" ? e.side === "buy" : e.side === "sell"));
    if (opening.length === 0) ctx.addIssue({ code: "custom", path: ["executions"], message: MSG.executions });
  });
export type TradeInput = z.infer<typeof tradeSchema>;

export const bulkUpdateSchema = z.object({
  ids: z.array(z.string()).min(1).max(5000),
  addTagNames: z.array(listNameSchema).max(50).optional(),
  playbookId: z.string().nullable().optional(),
});

// ---------- Journal ----------

export const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, MSG.date);

export const journalDaySchema = z.object({
  date: dayKeySchema,
  mood: rating,
  sleepHours: finite.min(0).max(24).nullable(),
  focus: rating,
  premarketPlan: z.string().max(50_000),
  review: z.string().max(50_000),
  lessons: z.string().max(50_000),
  followedPlan: z.boolean().nullable(),
});
export type JournalDayInput = z.infer<typeof journalDaySchema>;

// ---------- Settings ----------

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format HH:MM.");
const sessionWindow = z.object({ start: timeOfDay, end: timeOfDay });

export const generalSettingsSchema = z.object({
  baseCurrency: currencyCode,
  displayTimezone: timeZone,
  weekStartsOn: z.union([z.literal(0), z.literal(1), z.literal(6)]),
  beThreshold: finite.min(0, MSG.nonNegative),
  defaultAccountId: z.string().nullable(),
  defaultRiskPercent: finite.positive(MSG.positive).max(100),
});
export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>;

export const appearanceSettingsSchema = z.object({
  theme: z.enum(THEMES),
  compactTables: z.boolean(),
});

export const sessionsSettingsSchema = z.object({
  asia: sessionWindow,
  london: sessionWindow,
  newyork: sessionWindow,
});

// ---------- CSV import ----------

export const CSV_TARGET_FIELDS = [
  "symbol",
  "direction",
  "openedAt",
  "closedAt",
  "entry",
  "exit",
  "qty",
  "stop",
  "target",
  "fees",
  "swap",
  "netPnl",
  "notes",
] as const;
export type CsvTargetField = (typeof CSV_TARGET_FIELDS)[number];

export const csvMappingSchema = z.object({
  columns: z.record(z.string(), z.enum([...CSV_TARGET_FIELDS, "ignore"])),
  delimiter: z.enum([",", ";", "\t", "|"]),
  decimalSeparator: z.enum([".", ","]),
  dateFormat: z.string().min(4).max(40),
  longValue: z.string().max(40),
  shortValue: z.string().max(40),
});
export type CsvMapping = z.infer<typeof csvMappingSchema>;

/** Flattens zod issues into `{ "path.to.field": "message" }` (first message per field). */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
