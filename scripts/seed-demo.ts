/**
 * Demo data (section 15). Runs on server start only when SEED_DEMO=true and the database has no trades.
 * Everything hangs off the account "Demo CHF": deleting that account removes all demo trades (cascade).
 */
import { TZDate } from "@date-fns/tz";
import { count, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  accounts,
  emotions,
  instruments,
  journalDays,
  mistakes,
  playbookRules,
  playbooks,
  trades,
} from "@/lib/db/schema";
import { log } from "@/lib/log";
import { readSettings } from "@/lib/settings";
import { saveTrade } from "@/lib/trades/save";
import type { TradeInput } from "@/lib/validation";

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLAYBOOKS = [
  {
    name: "20 EMA Pullback",
    color: "#4F7CFF",
    description: "Trendfolge: Rücksetzer an den 20 EMA im etablierten Trend handeln.",
    rules: [
      "Klarer Trend auf dem höheren Timeframe",
      "Rücksetzer bis an den 20 EMA",
      "Bestätigungskerze vorhanden",
      "CRV mindestens 1 : 2",
    ],
  },
  {
    name: "Break & Retest",
    color: "#1FD286",
    description: "Ausbruch über ein Schlüssel-Level und Einstieg beim Retest.",
    rules: [
      "Level mindestens zweimal getestet",
      "Ausbruch mit Volumen",
      "Retest hält",
      "Stop hinter dem Level",
      "Keine News in den nächsten 30 Minuten",
    ],
  },
  {
    name: "Liquidity Sweep",
    color: "#B07CFF",
    description: "Stop-Hunt über Hoch/Tief, Einstieg nach der Rückeroberung.",
    rules: [
      "Sweep eines offensichtlichen Hochs/Tiefs",
      "Schnelle Rückeroberung des Levels",
      "Einstieg erst nach Struktur-Bruch",
    ],
  },
];

const INSTRUMENTS = [
  {
    symbol: "EURUSD",
    assetClass: "forex" as const,
    multiplier: 100_000,
    quoteCurrency: "USD",
    tickSize: 0.00001,
    price: 1.085,
    stop: 0.0025,
    decimals: 5,
  },
  {
    symbol: "XAUUSD",
    assetClass: "commodity" as const,
    multiplier: 100,
    quoteCurrency: "USD",
    tickSize: 0.01,
    price: 2650,
    stop: 6,
    decimals: 2,
  },
  {
    symbol: "NAS100",
    assetClass: "index" as const,
    multiplier: 1,
    quoteCurrency: "USD",
    tickSize: 0.1,
    price: 20_500,
    stop: 45,
    decimals: 1,
  },
  {
    symbol: "BTCUSD",
    assetClass: "crypto" as const,
    multiplier: 1,
    quoteCurrency: "USD",
    tickSize: 0.5,
    price: 67_000,
    stop: 900,
    decimals: 1,
  },
];

const TAGS = ["A+ Setup", "News-Tag", "Gegen Trend", "Trendtag", "Range"];
const NOTES = [
  "Sauberer Einstieg nach Plan. Geduldig auf die Bestätigung gewartet.",
  "Zu früh rein, Stop war aber korrekt platziert.",
  "Ziel erreicht, Teilgewinn am ersten Widerstand mitgenommen.",
  "Markt hat das Level nicht respektiert – Verlust akzeptiert.",
  "Gute Struktur, aber Volumen fehlte.",
];
const PLANS = [
  "- Fokus auf London Open\n- Nur A+ Setups\n- Max. 2 Trades",
  "- NFP um 14:30 – vorher kein Trade\n- Levels: Vortageshoch / -tief",
  "- Trend auf H4 bullisch\n- Pullbacks an den 20 EMA suchen",
];
const REVIEWS = [
  "Disziplin war gut, Plan eingehalten. Ein Trade weniger wäre besser gewesen.",
  "Zu ungeduldig am Morgen, danach stabil. Lektion: auf die Bestätigung warten.",
  "Ruhiger Tag, wenig Setups – kein Overtrading. Sehr zufrieden.",
  "Ein Revenge-Trade nach dem ersten Verlust. Nächstes Mal Pause machen.",
];

function round(value: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function seedDemo() {
  const db = getDb();
  const [{ value: tradeCount }] = db.select({ value: count() }).from(trades).all();
  if (tradeCount > 0) return false;

  const settings = readSettings();
  const tz = settings.displayTimezone;
  const random = rng(20261019);
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
  const fx = 0.88; // USD → CHF

  const account = db
    .insert(accounts)
    .values({
      name: "Demo CHF",
      type: "prop",
      currency: "CHF",
      startingBalance: 10_000,
      color: "#22C3E6",
      broker: "Demo",
    })
    .returning()
    .get();

  const playbookRows = PLAYBOOKS.map((p) => {
    const row = db
      .insert(playbooks)
      .values({ name: p.name, color: p.color, description: p.description })
      .returning()
      .get();
    const rules = p.rules.map((text, position) =>
      db.insert(playbookRules).values({ playbookId: row.id, text, position }).returning().get(),
    );
    return { ...row, rules };
  });

  for (const ins of INSTRUMENTS) {
    const existing = db.select().from(instruments).where(eq(instruments.symbol, ins.symbol)).get();
    if (!existing) {
      db.insert(instruments)
        .values({
          symbol: ins.symbol,
          assetClass: ins.assetClass,
          multiplier: ins.multiplier,
          quoteCurrency: ins.quoteCurrency,
          tickSize: ins.tickSize,
        })
        .run();
    }
  }

  const emotionNames = db
    .select()
    .from(emotions)
    .all()
    .map((e) => e.name);
  const mistakeRows = db.select().from(mistakes).all();
  const now = Date.now();
  const day = 86_400_000;
  // Fixed outcome mix (27 wins, 30 losses, 3 break-even ≈ 47 % win rate without BE), shuffled deterministically.
  const outcomes: ("win" | "loss" | "be")[] = [
    ...Array(27).fill("win"),
    ...Array(30).fill("loss"),
    ...Array(3).fill("be"),
  ];
  for (let i = outcomes.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]];
  }

  for (let i = 0; i < 60; i++) {
    const ins = pick(INSTRUMENTS);
    const pb = pick(playbookRows);
    const direction = random() < 0.55 ? "long" : "short";
    const daysAgo = Math.floor((i / 60) * 89) + Math.floor(random() * 2);
    const base = new TZDate(now - (89 - daysAgo) * day, tz);
    let dow = base.getDay();
    if (dow === 0 || dow === 6) {
      base.setDate(base.getDate() + (dow === 0 ? 1 : 2));
      dow = base.getDay();
    }
    base.setHours(8 + Math.floor(random() * 11), Math.floor(random() * 60), 0, 0);
    const openedAt = Math.min(base.getTime(), now - 3_600_000);

    const outcome = outcomes[i];
    const r = outcome === "win" ? 1.3 + random() * 1.1 : outcome === "loss" ? -(0.9 + random() * 0.15) : 0;
    const entry = round(ins.price * (0.94 + random() * 0.12), ins.decimals);
    const stopDist = ins.stop * (0.7 + random() * 0.6);
    const stop = round(direction === "long" ? entry - stopDist : entry + stopDist, ins.decimals);
    const riskPerUnit = Math.abs(entry - stop) * ins.multiplier * fx;
    const qty = Math.max(0.01, Math.floor((100 / riskPerUnit) * 100) / 100);
    const move = r * Math.abs(entry - stop);
    const exit = round(direction === "long" ? entry + move : entry - move, ins.decimals);
    const target = round(
      direction === "long" ? entry + Math.abs(entry - stop) * 2 : entry - Math.abs(entry - stop) * 2,
      ins.decimals,
    );
    const holdMinutes = 5 + Math.floor(random() * 360);
    const closedAt = Math.min(openedAt + holdMinutes * 60_000, now - 60_000);
    const opening = direction === "long" ? "buy" : "sell";
    const closing = direction === "long" ? "sell" : "buy";
    const win = outcome === "win";

    const input: TradeInput = {
      accountId: account.id,
      symbol: ins.symbol,
      direction,
      playbookId: pb.id,
      timeframe: pick(["5m", "15m", "1h"] as const),
      executions: [
        { side: opening, qty, price: entry, fee: round(qty * 0.5, 2), executedAt: openedAt },
        { side: closing, qty, price: exit, fee: round(qty * 0.5, 2), executedAt: closedAt },
      ],
      initialStop: stop,
      initialTarget: target,
      // Break-even demo trades are booked manually at exactly 0 so fees do not turn them into losses.
      pnlMode: outcome === "be" ? "manual" : "auto",
      manualNetPnl: outcome === "be" ? 0 : null,
      fxRate: fx,
      fees: 0,
      swap: 0,
      executionRating: win ? 3 + Math.floor(random() * 3) : 1 + Math.floor(random() * 3),
      confidence: 1 + Math.floor(random() * 5),
      emotionBefore: pick(emotionNames),
      emotionAfter: pick(emotionNames),
      mistakeIds: !win && random() < 0.7 ? [pick(mistakeRows).id] : random() < 0.15 ? [pick(mistakeRows).id] : [],
      tagNames: random() < 0.6 ? [pick(TAGS)] : [],
      ruleChecks: pb.rules.map((rule) => ({ ruleId: rule.id, checked: random() < (win ? 0.85 : 0.55) })),
      notes: random() < 0.5 ? pick(NOTES) : null,
      tradingviewUrl: null,
    };
    saveTrade(null, input);
  }

  for (let i = 0; i < 20; i++) {
    const date = new TZDate(now - Math.floor(i * 4.3) * day, tz);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    db.insert(journalDays)
      .values({
        date: key,
        mood: 2 + Math.floor(random() * 4),
        sleepHours: round(5.5 + random() * 3, 1),
        focus: 2 + Math.floor(random() * 4),
        premarketPlan: pick(PLANS),
        review: pick(REVIEWS),
        lessons: random() < 0.6 ? "Auf die Bestätigung warten." : "",
        followedPlan: random() < 0.7,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();
  }

  log.info("Demo data inserted (account “Demo CHF”)");
  return true;
}
