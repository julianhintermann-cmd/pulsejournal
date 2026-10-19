CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`broker` text,
	`type` text NOT NULL,
	`currency` text NOT NULL,
	`starting_balance` real DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`color` text DEFAULT '#4F7CFF' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cash_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`occurred_at` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cash_account_idx` ON `cash_transactions` (`account_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `csv_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mapping_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `emotions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emotions_name_unique` ON `emotions` (`name`);--> statement-breakpoint
CREATE TABLE `executions` (
	`id` text PRIMARY KEY NOT NULL,
	`trade_id` text NOT NULL,
	`side` text NOT NULL,
	`qty` real NOT NULL,
	`price` real NOT NULL,
	`fee` real DEFAULT 0 NOT NULL,
	`executed_at` integer NOT NULL,
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `executions_trade_idx` ON `executions` (`trade_id`,`executed_at`);--> statement-breakpoint
CREATE TABLE `import_log` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`file_name` text NOT NULL,
	`rows_total` integer DEFAULT 0 NOT NULL,
	`rows_imported` integer DEFAULT 0 NOT NULL,
	`rows_skipped` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`asset_class` text DEFAULT 'other' NOT NULL,
	`multiplier` real DEFAULT 1 NOT NULL,
	`quote_currency` text NOT NULL,
	`tick_size` real,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instruments_symbol_unique` ON `instruments` (`symbol`);--> statement-breakpoint
CREATE TABLE `journal_days` (
	`date` text PRIMARY KEY NOT NULL,
	`mood` integer,
	`sleep_hours` real,
	`focus` integer,
	`premarket_plan` text DEFAULT '' NOT NULL,
	`review` text DEFAULT '' NOT NULL,
	`lessons` text DEFAULT '' NOT NULL,
	`followed_plan` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mistakes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mistakes_name_unique` ON `mistakes` (`name`);--> statement-breakpoint
CREATE TABLE `playbook_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`playbook_id` text NOT NULL,
	`text` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`playbook_id`) REFERENCES `playbooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `playbook_rules_playbook_idx` ON `playbook_rules` (`playbook_id`);--> statement-breakpoint
CREATE TABLE `playbooks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#4F7CFF' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `screenshots` (
	`id` text PRIMARY KEY NOT NULL,
	`trade_id` text,
	`journal_date` text,
	`file_path` text NOT NULL,
	`thumb_path` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`caption` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `screenshots_trade_idx` ON `screenshots` (`trade_id`);--> statement-breakpoint
CREATE INDEX `screenshots_journal_idx` ON `screenshots` (`journal_date`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`base_currency` text DEFAULT 'CHF' NOT NULL,
	`display_timezone` text DEFAULT 'Europe/Zurich' NOT NULL,
	`theme` text DEFAULT 'dark' NOT NULL,
	`be_threshold` real DEFAULT 0 NOT NULL,
	`week_starts_on` integer DEFAULT 1 NOT NULL,
	`default_account_id` text,
	`default_risk_percent` real DEFAULT 1 NOT NULL,
	`sessions_json` text DEFAULT '{"asia":{"start":"01:00","end":"09:00"},"london":{"start":"09:00","end":"14:30"},"newyork":{"start":"14:30","end":"22:00"}}' NOT NULL,
	`compact_tables` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#9AA3B5' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `trade_mistakes` (
	`trade_id` text NOT NULL,
	`mistake_id` text NOT NULL,
	PRIMARY KEY(`trade_id`, `mistake_id`),
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mistake_id`) REFERENCES `mistakes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trade_mistakes_mistake_idx` ON `trade_mistakes` (`mistake_id`);--> statement-breakpoint
CREATE TABLE `trade_rule_checks` (
	`trade_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`trade_id`, `rule_id`),
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`) REFERENCES `playbook_rules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `trade_tags` (
	`trade_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`trade_id`, `tag_id`),
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trade_tags_tag_idx` ON `trade_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`instrument_id` text NOT NULL,
	`playbook_id` text,
	`direction` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`timeframe` text,
	`session` text DEFAULT 'off' NOT NULL,
	`initial_stop` real,
	`initial_target` real,
	`pnl_mode` text DEFAULT 'auto' NOT NULL,
	`manual_net_pnl` real,
	`fx_rate` real DEFAULT 1 NOT NULL,
	`fees` real DEFAULT 0 NOT NULL,
	`swap` real DEFAULT 0 NOT NULL,
	`execution_rating` integer,
	`confidence` integer,
	`emotion_before` text,
	`emotion_after` text,
	`notes` text,
	`tradingview_url` text,
	`entry_avg` real,
	`exit_avg` real,
	`qty_opened` real DEFAULT 0 NOT NULL,
	`qty_closed` real DEFAULT 0 NOT NULL,
	`gross_pnl` real,
	`net_pnl` real,
	`initial_risk` real,
	`r_multiple` real,
	`result` text DEFAULT 'open' NOT NULL,
	`hold_minutes` real,
	`import_hash` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`playbook_id`) REFERENCES `playbooks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trades_import_hash_unique` ON `trades` (`import_hash`);--> statement-breakpoint
CREATE INDEX `trades_account_closed_idx` ON `trades` (`account_id`,`closed_at`);--> statement-breakpoint
CREATE INDEX `trades_instrument_idx` ON `trades` (`instrument_id`);--> statement-breakpoint
CREATE INDEX `trades_playbook_idx` ON `trades` (`playbook_id`);--> statement-breakpoint
CREATE INDEX `trades_opened_idx` ON `trades` (`opened_at`);--> statement-breakpoint
CREATE INDEX `trades_result_idx` ON `trades` (`result`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);