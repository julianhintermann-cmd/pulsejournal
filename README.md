# Pulse Journal

A private, self-hosted trading journal for exactly one owner. It runs as a single Docker container on your
home NAS, keeps everything in SQLite plus an uploads folder on one volume and installs on your phone as an app
(PWA). The user interface is German.

## Features

- **Fast trade capture** – quick mode for the phone (≤ 6 taps + typing) and a detailed mode with partial
  executions, fees, swap, FX conversion, manual P&L, risk / R:R chips and a position-size suggestion.
- **Review** – screenshots (drag & drop, paste, camera) with pinch-zoom lightbox, markdown notes, playbook
  checklists, mistakes, emotions, confidence and execution ratings, tags, TradingView link.
- **Honest statistics** – net P&L, win rate (BE excluded), profit factor, expectancy in money and R, total R,
  max drawdown on the balance curve, streaks, hold times and breakdowns by setup, weekday, hour, session,
  hold time, symbol, direction, emotion, mistake cost, confidence, execution and an R histogram.
- **Dashboard** – KPI cards with period comparison, equity curve, daily P&L, calendar heat map, recent
  trades, best setups and most expensive mistakes.
- **Calendar and daily journal** – P&L calendar with week totals, pre-market plan, review, lessons, mood,
  sleep and focus with autosave.
- **Playbooks** with rules, per-setup stats and "best examples" gallery.
- **Accounts** (live, demo, prop, funded) with deposits, withdrawals, fees and payouts.
- **Import / export** – CSV import wizard with column mapping, saved mappings and duplicate detection, CSV
  export, full backup zip, automatic daily backups and one-click restore.
- **Installable PWA** with offline fallback, command palette (⌘K), keyboard shortcuts, dark and light theme.

## Quick start on a NAS (Docker Compose)

1. Create a folder on the NAS, e.g. `/volume1/docker/pulse-journal`, and put this `docker-compose.yml` into it
   (forks publish to `ghcr.io/<their-account-in-lower-case>/pulse-journal`):

   ```yaml
   services:
     pulse-journal:
       image: ghcr.io/julianhintermann-cmd/pulse-journal:latest
       container_name: pulse-journal
       restart: unless-stopped
       ports:
         - "3080:3000"
       environment:
         - TZ=Europe/Zurich
         - PUID=1000
         - PGID=1000
       volumes:
         - ./data:/data
   ```

2. Start it:

   ```sh
   docker compose up -d
   ```

3. Open `http://<NAS-IP>:3080` and complete the setup (username, password, base currency, time zone and your
   first account). Every route redirects to the setup page until it is done.

`PUID` / `PGID` should match the NAS user that owns the `./data` folder (on Synology: `id <user>` via SSH).

### Private GHCR package

If the package on GitHub is private, log in once on the NAS with a Personal Access Token (classic) that only
has the `read:packages` scope:

```sh
docker login ghcr.io -u <github-user>
# Password: the personal access token
```

Alternatively make the package public: GitHub → your profile → Packages → `pulse-journal` → Package settings →
Change visibility → Public.

### Updating

```sh
docker compose pull && docker compose up -d
```

All data stays in `./data`; database migrations run automatically on start.

## HTTPS and installing the app (PWA)

- **Android (Chrome)**: works over plain HTTP in your LAN. Open Pulse, then use the "Installieren" button on
  the dashboard or the browser menu → "App installieren".
- **iPhone / iPad (Safari)**: Safari → Share → "Zum Home-Bildschirm". iOS only enables service workers (offline
  page, caching) over **HTTPS** (except `localhost`).
- Recommended for HTTPS: the NAS's built-in reverse proxy with a certificate (e.g. Synology "Login Portal →
  Reverse Proxy" with Let's Encrypt), **Tailscale HTTPS** (`tailscale serve`) or **Nginx Proxy Manager**.
  Forward to `http://<NAS-IP>:3080` and keep the `X-Forwarded-Proto` header – the session cookie is then marked
  `Secure` automatically (`COOKIE_SECURE=auto`).
- Over plain HTTP everything works, just without offline support.

## Backups

- **Automatic**: every day at 03:30 (display time zone) a zip is written to `./data/backups/`
  (`pulse-backup-YYYY-MM-DD.zip`). The newest `BACKUP_KEEP_DAYS` (default 14) are kept. They are listed – with
  download buttons – under Import/Export.
- **Manual**: Import/Export → "Backup herunterladen". The zip contains `journal.db` (a consistent `VACUUM INTO`
  snapshot), the `uploads` folder and `manifest.json` (app version, schema version, creation time).
- **Restore**: Import/Export → "Backup wiederherstellen", choose the zip and type `WIEDERHERSTELLEN`. Database and
  uploads are swapped atomically (the old files are kept until the swap succeeded), migrations are applied and
  every session is logged out. A backup also restores into a completely fresh container.
- Copying the whole `./data` folder while the container is stopped is a valid backup as well.

## Environment variables

| Variable           | Default         | Meaning                                                                                                             |
| ------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------- |
| `PORT`             | `3000`          | HTTP port inside the container                                                                                      |
| `DATA_DIR`         | `/data`         | Root of all persistent data                                                                                         |
| `TZ`               | `Europe/Zurich` | Container time zone (the display time zone is a setting in the app)                                                 |
| `SESSION_SECRET`   | _(empty)_       | If empty: 64 random bytes are generated on first start and stored in `${DATA_DIR}/secret.key` (chmod 600)           |
| `COOKIE_SECURE`    | `auto`          | `auto` = secure cookie only for HTTPS requests (`x-forwarded-proto: https`); `true` / `false` force it              |
| `PUID` / `PGID`    | `1000` / `1000` | User / group the app runs as (the entrypoint chowns `${DATA_DIR}` and drops privileges with gosu)                   |
| `BACKUP_KEEP_DAYS` | `14`            | Number of automatic daily backups to keep                                                                           |
| `SEED_DEMO`        | `false`         | When `true` and the database has no trades, insert demo data (account "Demo CHF"; delete that account to remove it) |
| `LOG_LEVEL`        | `info`          | `debug` / `info` / `warn` / `error`                                                                                 |

Data layout on the volume:

```
/data/journal.db            (+ -wal, -shm)
/data/secret.key
/data/uploads/YYYY/MM/<uuid>.webp
/data/uploads/YYYY/MM/<uuid>_thumb.webp
/data/backups/pulse-backup-YYYY-MM-DD.zip
```

`/data/uploads` and `/data/backups` may be separate bind mounts, e.g. to keep the database on an SSD and
screenshots and backups on a larger HDD:

```yaml
volumes:
  - /volume2/docker/pulse-journal/data:/data
  - /volume1/data/pulse-journal/uploads:/data/uploads
  - /volume1/data/pulse-journal/backups:/data/backups
```

## Development

Requirements: Node.js 24 and pnpm 10 (`corepack enable`).

```sh
pnpm i                 # install dependencies
pnpm dev               # dev server on http://localhost:3000 (set DATA_DIR=./.data to keep data in the repo folder)
pnpm test              # unit tests (vitest)
pnpm test:e2e          # Playwright smoke test (builds and starts the app with a temporary DATA_DIR)
pnpm lint              # ESLint
pnpm typecheck         # TypeScript
pnpm build             # production build (standalone output, `pnpm start` runs it)
pnpm db:generate       # generate a Drizzle migration after changing src/lib/db/schema.ts
pnpm generate:icons    # render PWA icons and favicons from src/assets/logo.svg
```

Example: `DATA_DIR=./.data SEED_DEMO=true pnpm dev` starts with demo data.

### Releases

Versions follow SemVer (`package.json`, `CHANGELOG.md`). Pushing to `main` publishes
`ghcr.io/<owner>/pulse-journal:latest` and a short-SHA tag; pushing a tag `vX.Y.Z` additionally publishes `X.Y.Z`
and `X.Y`. Images are built for `linux/amd64` and `linux/arm64`.

## License

MIT
