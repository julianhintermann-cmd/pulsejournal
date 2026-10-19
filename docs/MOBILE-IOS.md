# Mobile iOS experience

Notes for the iOS 26 style mobile layer (viewports below 768 px). The audit and the component map are in
[`MOBILE-IOS-PLAN.md`](MOBILE-IOS-PLAN.md).

## Progress

### M0 – Audit and plan

- Inventory, web tells and architecture decisions: `docs/MOBILE-IOS-PLAN.md`.
- Before screenshots: `docs/mobile-before/` (`node tests/visual/capture.mjs --out docs/mobile-before --set mobile`).
- Desktop/tablet baselines for the pixel diff are captured with `--set desktop` into a local folder (not committed,
  ~25 MB).

## Deviations from the brief

- Playwright WebKit could not be downloaded in the build sandbox (`cdn.playwright.dev` is blocked there). Local
  checks use Chromium with iPhone profiles (touch, iPhone user agent, DPR 3); the WebKit projects are configured in
  `playwright.config.ts` and run in CI and on the developer's machine.
