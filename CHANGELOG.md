# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-19

### Added

- First-start setup, login with rate limiting, 30-day sliding sessions, password change and session revocation.
- Responsive app shell: sidebar, icon rail, mobile bottom tab bar with "+" button, global filter, command
  palette and keyboard shortcuts.
- Accounts with cash transactions, instruments, tags, mistakes and emotions management, settings.
- Trade form (quick and detailed), executions, risk helpers, screenshots, trade detail with lightbox, duplicate,
  delete with undo.
- Trades list with sortable, virtualized table, mobile day cards, filters and bulk actions.
- Dashboard, calendar, daily journal with autosave, statistics tabs and playbooks.
- CSV import wizard and export, backup download, automatic daily backups and restore.
- Installable PWA with service worker and offline page.
- Multi-arch Docker image (amd64, arm64) published to GHCR, CI with unit and e2e tests.
- Optional demo data (`SEED_DEMO=true`).

[Unreleased]: https://github.com/julianhintermann-cmd/pulsejournal/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/julianhintermann-cmd/pulsejournal/releases/tag/v0.1.0
