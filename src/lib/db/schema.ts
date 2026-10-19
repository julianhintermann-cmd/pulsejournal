import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now());

export const ACCOUNT_TYPES = ["live", "demo", "prop", "funded"] as const;
export const CASH_TYPES = ["deposit", "withdrawal", "fee", "payout"] as const;
export const ASSET_CLASSES = ["forex", "crypto", "index", "stock", "futures", "commodity", "other"] as const;
export const DIRECTIONS = ["long", "short"] as const;
export const TRADE_STATUSES = ["open", "closed"] as const;
export const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1D", "1W"] as const;
export const SESSIONS = ["asia", "london", "newyork", "off"] as const;
export const PNL_MODES = ["auto", "manual"] as const;
export const RESULTS = ["win", "loss", "be", "open"] as const;
export const SIDES = ["buy", "sell"] as const;
export const THEMES = ["dark", "light", "system"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type CashType = (typeof CASH_TYPES)[number];
export type AssetClass = (typeof ASSET_CLASSES)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type Timeframe = (typeof TIMEFRAMES)[number];
export type TradingSession = (typeof SESSIONS)[number];
export type PnlMode = (typeof PNL_MODES)[number];
export type TradeResult = (typeof RESULTS)[number];
export type Side = (typeof SIDES)[number];
export type Theme = (typeof THEMES)[number];

export const users = sqliteTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: createdAt(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey().default(1),
  baseCurrency: text("base_currency").notNull().default("CHF"),
  displayTimezone: text("display_timezone").notNull().default("Europe/Zurich"),
  theme: text("theme", { enum: THEMES }).notNull().default("dark"),
  beThreshold: real("be_threshold").notNull().default(0),
  weekStartsOn: integer("week_starts_on").notNull().default(1),
  defaultAccountId: text("default_account_id"),
  defaultRiskPercent: real("default_risk_percent").notNull().default(1),
  sessionsJson: text("sessions_json")
    .notNull()
    .default(
      sql`'{"asia":{"start":"01:00","end":"09:00"},"london":{"start":"09:00","end":"14:30"},"newyork":{"start":"14:30","end":"22:00"}}'`,
    ),
  compactTables: integer("compact_tables", { mode: "boolean" }).notNull().default(false),
});

export const accounts = sqliteTable("accounts", {
  id: id(),
  name: text("name").notNull(),
  broker: text("broker"),
  type: text("type", { enum: ACCOUNT_TYPES }).notNull(),
  currency: text("currency").notNull(),
  startingBalance: real("starting_balance").notNull().default(0),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  color: text("color").notNull().default("#4F7CFF"),
  createdAt: createdAt(),
});

export const cashTransactions = sqliteTable(
  "cash_transactions",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: text("type", { enum: CASH_TYPES }).notNull(),
    amount: real("amount").notNull(),
    occurredAt: integer("occurred_at").notNull(),
    note: text("note"),
  },
  (t) => [index("cash_account_idx").on(t.accountId, t.occurredAt)],
);

export const instruments = sqliteTable("instruments", {
  id: id(),
  symbol: text("symbol").notNull().unique(),
  assetClass: text("asset_class", { enum: ASSET_CLASSES }).notNull().default("other"),
  multiplier: real("multiplier").notNull().default(1),
  quoteCurrency: text("quote_currency").notNull(),
  tickSize: real("tick_size"),
  createdAt: createdAt(),
});

export const playbooks = sqliteTable("playbooks", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#4F7CFF"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export const playbookRules = sqliteTable(
  "playbook_rules",
  {
    id: id(),
    playbookId: text("playbook_id")
      .notNull()
      .references(() => playbooks.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("playbook_rules_playbook_idx").on(t.playbookId)],
);

export const trades = sqliteTable(
  "trades",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    instrumentId: text("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    playbookId: text("playbook_id").references(() => playbooks.id, { onDelete: "set null" }),
    direction: text("direction", { enum: DIRECTIONS }).notNull(),
    status: text("status", { enum: TRADE_STATUSES }).notNull().default("open"),
    openedAt: integer("opened_at").notNull(),
    closedAt: integer("closed_at"),
    timeframe: text("timeframe", { enum: TIMEFRAMES }),
    session: text("session", { enum: SESSIONS }).notNull().default("off"),
    initialStop: real("initial_stop"),
    initialTarget: real("initial_target"),
    pnlMode: text("pnl_mode", { enum: PNL_MODES }).notNull().default("auto"),
    manualNetPnl: real("manual_net_pnl"),
    fxRate: real("fx_rate").notNull().default(1),
    fees: real("fees").notNull().default(0),
    swap: real("swap").notNull().default(0),
    executionRating: integer("execution_rating"),
    confidence: integer("confidence"),
    emotionBefore: text("emotion_before"),
    emotionAfter: text("emotion_after"),
    notes: text("notes"),
    tradingviewUrl: text("tradingview_url"),
    // Derived columns, recomputed by recomputeTrade()
    entryAvg: real("entry_avg"),
    exitAvg: real("exit_avg"),
    qtyOpened: real("qty_opened").notNull().default(0),
    qtyClosed: real("qty_closed").notNull().default(0),
    grossPnl: real("gross_pnl"),
    netPnl: real("net_pnl"),
    initialRisk: real("initial_risk"),
    rMultiple: real("r_multiple"),
    result: text("result", { enum: RESULTS }).notNull().default("open"),
    holdMinutes: real("hold_minutes"),
    importHash: text("import_hash").unique(),
    deletedAt: integer("deleted_at"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    index("trades_account_closed_idx").on(t.accountId, t.closedAt),
    index("trades_instrument_idx").on(t.instrumentId),
    index("trades_playbook_idx").on(t.playbookId),
    index("trades_opened_idx").on(t.openedAt),
    index("trades_result_idx").on(t.result),
  ],
);

export const executions = sqliteTable(
  "executions",
  {
    id: id(),
    tradeId: text("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    side: text("side", { enum: SIDES }).notNull(),
    qty: real("qty").notNull(),
    price: real("price").notNull(),
    fee: real("fee").notNull().default(0),
    executedAt: integer("executed_at").notNull(),
  },
  (t) => [index("executions_trade_idx").on(t.tradeId, t.executedAt)],
);

export const tags = sqliteTable("tags", {
  id: id(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#9AA3B5"),
});

export const tradeTags = sqliteTable(
  "trade_tags",
  {
    tradeId: text("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.tradeId, t.tagId] }), index("trade_tags_tag_idx").on(t.tagId)],
);

export const mistakes = sqliteTable("mistakes", {
  id: id(),
  name: text("name").notNull().unique(),
  position: integer("position").notNull().default(0),
});

export const tradeMistakes = sqliteTable(
  "trade_mistakes",
  {
    tradeId: text("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    mistakeId: text("mistake_id")
      .notNull()
      .references(() => mistakes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.tradeId, t.mistakeId] }), index("trade_mistakes_mistake_idx").on(t.mistakeId)],
);

export const emotions = sqliteTable("emotions", {
  id: id(),
  name: text("name").notNull().unique(),
  position: integer("position").notNull().default(0),
});

export const tradeRuleChecks = sqliteTable(
  "trade_rule_checks",
  {
    tradeId: text("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    ruleId: text("rule_id")
      .notNull()
      .references(() => playbookRules.id, { onDelete: "cascade" }),
    checked: integer("checked", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.tradeId, t.ruleId] })],
);

export const screenshots = sqliteTable(
  "screenshots",
  {
    id: id(),
    tradeId: text("trade_id").references(() => trades.id, { onDelete: "cascade" }),
    journalDate: text("journal_date"),
    filePath: text("file_path").notNull(),
    thumbPath: text("thumb_path").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    caption: text("caption"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("screenshots_trade_idx").on(t.tradeId), index("screenshots_journal_idx").on(t.journalDate)],
);

export const journalDays = sqliteTable("journal_days", {
  date: text("date").primaryKey(),
  mood: integer("mood"),
  sleepHours: real("sleep_hours"),
  focus: integer("focus"),
  premarketPlan: text("premarket_plan").notNull().default(""),
  review: text("review").notNull().default(""),
  lessons: text("lessons").notNull().default(""),
  followedPlan: integer("followed_plan", { mode: "boolean" }),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const csvMappings = sqliteTable("csv_mappings", {
  id: id(),
  name: text("name").notNull(),
  mappingJson: text("mapping_json").notNull(),
  createdAt: createdAt(),
});

export const importLog = sqliteTable("import_log", {
  id: id(),
  source: text("source", { enum: ["csv", "backup"] }).notNull(),
  fileName: text("file_name").notNull(),
  rowsTotal: integer("rows_total").notNull().default(0),
  rowsImported: integer("rows_imported").notNull().default(0),
  rowsSkipped: integer("rows_skipped").notNull().default(0),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type CashTransaction = typeof cashTransactions.$inferSelect;
export type Instrument = typeof instruments.$inferSelect;
export type Playbook = typeof playbooks.$inferSelect;
export type PlaybookRule = typeof playbookRules.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type Execution = typeof executions.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Mistake = typeof mistakes.$inferSelect;
export type Emotion = typeof emotions.$inferSelect;
export type Screenshot = typeof screenshots.$inferSelect;
export type JournalDay = typeof journalDays.$inferSelect;
export type CsvMapping = typeof csvMappings.$inferSelect;
