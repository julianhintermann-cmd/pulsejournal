# Decisions

Assumptions and choices made where the specification left room. Format: file path – one sentence.

## Stack and tooling

- `package.json` – Exact versions within the required majors: Next 16.4, React 19.3, Tailwind 4, Recharts 3, TanStack Table 8, Drizzle 0.45, motion 12, lucide-react 0.577, zod 4, vitest 4, ESLint 9 (flat config of `eslint-config-next` 16) and TypeScript 5.9 (newest line supported by the Next/ESLint tooling).
- `package.json` – `@playwright/test` is pinned to 1.56.1 so local runs use the preinstalled Chromium build; CI installs the matching browser with `playwright install`.
- `package.json` – `pnpm start` runs the standalone server (`node .next/standalone/server.js`); `scripts/postbuild.mjs` copies static assets, `public`, the migrations into the standalone folder and stamps the service worker version.
- `src/components/ui/*` – shadcn/ui "new-york" components were taken from the official registry source and restyled to the design tokens; unused ones (sheet, select, alert-dialog, toggle) were removed.
- `src/components/ui/native-select.tsx` – Form selects use a styled native `<select>` (system picker on phones) instead of the shadcn Select.
- `src/components/responsive-dialog.tsx` – Bottom sheets are built from Radix Dialog + motion (spring 400/40, drag handle) instead of adding `vaul`.
- `src/components/global-filter.tsx` – The custom date range uses two native date inputs instead of adding `react-day-picker`.
- `src/app/layout.tsx` – Theme switching uses a server-rendered `data-theme` attribute from the settings instead of `next-themes`.
- `src/assets/fonts/` – Inter variable (latin subset, upright) from `@fontsource-variable/inter` 5.3.0 is committed; italic is synthesized so only one font file is preloaded.
- `src/lib/format.ts` – Numbers are formatted deterministically (’ grouping, true minus) instead of `Intl`, because Node's ICU uses a different group separator than browsers and would cause hydration mismatches.

- `src/components/app-shell.tsx` – Skeletons are shown by the app shell for client-side navigations that take longer than 150 ms instead of route-level `loading.tsx`, because streamed loading boundaries delay the real content of the initial page (LCP) even when the server answers in ~30 ms.
- `src/components/app-shell.tsx` – The page transition is a CSS animation that only runs for client-side navigations, so the first paint is never hidden behind JavaScript.
- `src/components/charts/lazy.tsx` – Recharts is loaded after the `load` event when the browser is idle and charts render one per idle period once scrolled near the viewport; placeholders reserve the chart height (no layout shift).
- `src/components/responsive-dialog.tsx` – The motion-based dialog/sheet implementation is loaded when a dialog opens for the first time; the command palette likewise loads on first use.
- `src/components/install-hint.tsx` – The install hint is a compact floating banner above the tab bar whose instructions open in a sheet, so it neither shifts the layout nor becomes the page's largest paint.
- `src/lib/validation.ts` – zod runs with `jitless: true`, so its `new Function` capability probe does not trigger CSP violations.

## Auth and security

- `src/lib/auth/session.ts` – Session ids are stored as HMAC-SHA256(secret, token), which uses `SESSION_SECRET` / `secret.key` and is still a SHA-256 hash of the token.
- `src/proxy.ts` – The proxy only checks for the session cookie (no database access) and slides the cookie expiry on GET requests; the session itself is validated in every page, action and route handler.
- `src/lib/auth/guard.ts` – The "redirect everything to /setup" rule is enforced by `requireUser()` and the login page (no user → `/setup`), because the proxy has no database access.
- `src/proxy.ts` – `/api/import/backup` is excluded from the proxy matcher so large backup uploads are not buffered (the handler still authenticates); server actions and the proxy allow 20 MB bodies for 15 MB screenshots.
- `next.config.ts` – The CSP allows `'unsafe-inline'` scripts because Next.js injects inline bootstrap scripts (no nonce setup); `'unsafe-eval'` and websockets are allowed only in development.
- `src/lib/auth/rate-limit.ts` – The login limit counts failed attempts per client IP (first `x-forwarded-for` hop, else `x-real-ip`), in memory.

## Data model

- `src/lib/db/schema.ts` – `settings.compact_tables` was added for the "Kompakte Tabellen" switch, and `trades.deleted_at` / `trades.import_hash` as described in sections 5.18 and 8.13.
- `src/lib/db/schema.ts` – `trades.emotion_before/after` store the emotion name; renaming or deleting an emotion updates or clears the trades.
- `src/lib/db/seed.ts` – Default mistakes and emotions are inserted only together with the settings row (fresh database), so deleted defaults do not come back.
- `src/server/actions/lists.ts` – Tags and instruments have no position column, so they are listed alphabetically; reordering exists for mistakes and emotions.
- `src/server/actions/lists.ts` – Instruments used by trades cannot be deleted (the trade foreign key is `restrict`); the UI disables the delete button.
- `src/server/actions/accounts.ts` – Deleting an account cascades to its trades, cash transactions and screenshot rows and also deletes the screenshot files.
- `src/server/actions/playbooks.ts` – Editing rules keeps existing rule ids so trade checklists stay attached; deleting a playbook keeps its trades without setup.

## Calculations and statistics

- `src/lib/calc/trade.ts` – Open trades with partial exits store the realized P&L of the closed quantity; R, result and hold time stay empty until the trade is closed, and statistics use closed trades only.
- `src/lib/calc/trade.ts` – A stop exactly at the entry price counts as "wrong side" (risk would be zero).
- `src/lib/stats/metrics.ts` – R buckets are symmetric: negative buckets are upper-inclusive (−1.00R → "−2…−1"), positive buckets lower-inclusive (+1.00R → "1…2").
- `src/lib/stats/metrics.ts` – Hold-time buckets are lower-inclusive (exactly 5 min → "5–30 min").
- `src/lib/stats/metrics.ts` – Max drawdown is measured on the balance curve including cash flows, so withdrawals, fees and payouts lower the curve like losses (as specified).
- `src/lib/sessions.ts` – Session windows are start-inclusive and end-exclusive, may wrap past midnight and are checked in the order Asia → London → New York.
- `src/lib/filter.ts` – The global period applies to `closed_at` for statistics, dashboard, calendar and playbooks and to `opened_at` for the trade list, CSV export and prev/next on the detail page.
- `src/lib/filter-server.ts` – Besides URL and localStorage, the filter is mirrored in a cookie so server pages render the persisted filter without a client redirect.
- `src/lib/stats/queries.ts` – With "Alle Konten" money KPIs cover base-currency accounts; if no account uses the base currency, the most common account currency is used instead.
- `src/lib/db/queries.ts` – Account "return % since start" is Σ net P&L divided by the starting balance.
- `src/lib/playbooks.ts` – The playbook card sparkline is the cumulative R curve (currency independent).
- `src/lib/stats/queries.ts` – "Rules followed %" counts the rules of the trade's current playbook.
- `src/lib/stats/dashboard.ts` – A mistake's cost is the summed net P&L of all trades carrying it; a trade with two mistakes counts for both.
- `src/components/kpi-card.tsx` – Money KPIs of 1’000 and more are shown without cents so they fit the two-column phone layout.

## Features and UX

- `src/components/trade-form/trade-form.tsx` – A new symbol creates its instrument when the symbol field is left (not on save), so the inline "Neues Instrument angelegt – Multiplikator prüfen" link can open the instrument dialog right in the form.
- `src/components/trade-form/trade-form.tsx` – Screenshots of a trade are uploaded after the trade has been saved (one request per image); journal screenshots are stored immediately.
- `src/lib/trade-mode.ts` – The last used form mode is remembered in a cookie (and localStorage); without one, phones (by user agent) start in quick mode, other devices in detailed mode.
- `src/components/trade-form/payload.ts` – Quick mode is only available for trades with one entry and at most one full exit; others open in detailed mode.
- `src/server/actions/trades.ts` – Duplicating creates a trade without executions and opens it in the detailed edit form to add them.
- `src/server/actions/trades.ts` – Single delete is a soft delete with a 5 s undo (purged by a timer and on start-up); bulk delete is permanent after the confirm dialog.
- `src/server/actions/trades.ts` – Assigning a setup in bulk clears the existing rule checks of those trades.
- `src/components/trades/trades-view.tsx` – List filters run client-side on the trades of the global period and are stored in the URL; the table is shown from 1024 px, cards below.
- `src/components/keyboard-shortcuts.tsx` – `/` focuses the trade search on the trades page and opens the command palette elsewhere.
- `src/lib/uploads.ts` – HEIC is accepted but only decodable if the bundled libvips supports it; otherwise a German error asks for JPEG/PNG (iOS usually converts automatically).
- `src/lib/journal.ts` – The journal list shows days with an entry or with closed trades.
- `src/components/nav-items.ts` – The global filter appears on dashboard, trades, statistics and playbooks; the calendar shows only the account part.
- `src/components/install-hint.tsx` – The install hint is shown on the dashboard on mobile user agents only.
- `src/components/settings/general-settings.tsx` – The week can start on Monday, Sunday or Saturday.

## Import, export and backups

- `src/lib/import/csv.ts` – The entry price is required for CSV rows; a mapped "Netto P&L" column switches the trade to manual P&L, imported fees become trade fees.
- `src/lib/import/tradingview.ts` – TradingView trade history exports (one row per entry/exit, grouped by trade number) are recognised by their headers and converted to one row per trade; the exchange prefix is dropped from the symbol (`NASDAQ:AAPL` → `AAPL`) and the P&L column is imported as manual net P&L.
- `src/lib/import/tradingview.ts` – A trade whose exit quantity does not match the entry quantity is imported as an open position.
- `src/lib/import/csv.ts` – An optional "Trade-ID" column (TradingView: order id of the first entry) is appended to the dedupe key, because exports with minute timestamps contain distinct trades that agree on all other key fields.
- `src/lib/import/run.ts` – When "Duplikate überspringen" is off, re-imported duplicates are saved without hash (the column is unique).
- `src/app/api/export/trades.csv/route.ts` – The CSV export adds a "Währung" column next to "Netto P&L" and writes plain numbers with a decimal point.
- `src/lib/backup.ts` – The backup schema version is the number of shipped migrations; a backup from a newer schema is rejected.
- `src/lib/backup.ts` – Retention counts only automatic daily files (`pulse-backup-YYYY-MM-DD.zip`); manual downloads are not stored on the server.
- `src/lib/backup.ts` – A restore swaps the contents of the uploads folder instead of renaming the folder, so `/data/uploads` can be a separate mount on another disk.
- `docker/entrypoint.sh` – Ownership and access are checked separately for `/data`, `/data/uploads` and `/data/backups` (they may be separate mounts); a folder the app user cannot read and write is chowned and gets `u+rwX`, which also fixes NAS shares whose ACLs deny access despite the right owner.
- `src/app/api/import/backup/route.ts` – After a restore all sessions are deleted, so every device has to log in again.

## Delivery

- `Dockerfile` – The image name stays `pulse-journal`; the source URL for OCI labels and the "Über" link is passed as `REPO_URL` build arg (this repository is `julianhintermann-cmd/pulsejournal`).
- `Dockerfile` – Measured locally: 98 MB compressed, about 300 MB uncompressed, of which the mandated `node:24-bookworm-slim` base accounts for ~250 MB.
- `docker/entrypoint.sh` – When the container is started as a non-root user, the entrypoint skips user creation, chown and gosu.
- `.github/workflows/ci.yml` – pnpm is enabled via corepack and cached with `actions/cache` to use only official `actions/*` actions; CI also runs the Playwright smoke test.
- `public/sw.js` – Navigations are cached network-first for the offline fallback, so recently viewed pages are stored in the browser cache of the device.
- `scripts/seed-demo.ts` – Demo break-even trades use manual P&L 0 so fees do not turn them into losses; the outcome mix is fixed (27 wins, 30 losses, 3 BE ≈ 47 % win rate without BE).
