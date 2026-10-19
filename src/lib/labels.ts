import type { AccountType, AssetClass, CashType, Direction, Theme, TradeResult } from "@/lib/db/schema";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  live: "Live",
  demo: "Demo",
  prop: "Prop",
  funded: "Funded",
};

export const CASH_TYPE_LABELS: Record<CashType, string> = {
  deposit: "Einzahlung",
  withdrawal: "Auszahlung",
  fee: "Gebühr",
  payout: "Payout",
};

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  forex: "Forex",
  crypto: "Krypto",
  index: "Index",
  stock: "Aktie",
  futures: "Futures",
  commodity: "Rohstoff",
  other: "Andere",
};

export const RESULT_LABELS: Record<TradeResult, string> = {
  win: "Gewinn",
  loss: "Verlust",
  be: "Break-even",
  open: "Offen",
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  long: "Long",
  short: "Short",
};

export const THEME_LABELS: Record<Theme, string> = {
  dark: "Dunkel",
  light: "Hell",
  system: "System",
};

export const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

export const MOOD_EMOJI = ["😣", "🙁", "😐", "🙂", "😄"] as const;
