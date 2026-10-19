# Mobile iOS rework – audit and plan

Scope: viewports below 768 px (and `display-mode: standalone`). Tablet (768–1023 px) and desktop (≥ 1024 px) stay
pixel-identical; baselines were captured before any change (`tests/visual/capture.mjs --set desktop`) and are diffed
after every milestone.

## 1. Inventory of the mobile UI (before)

| Area                                                                        | Files                                                                                                                   |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Root layout, `<head>`, viewport, theme colour                               | `src/app/layout.tsx`, `src/app/manifest.ts`, `public/icons/*`, `scripts/generate-icons.mjs`                             |
| Global styles and tokens                                                    | `src/app/globals.css`                                                                                                   |
| App shell (sidebar, top bar, tab bar, page transition, navigation skeleton) | `src/components/app-shell.tsx`, `top-bar.tsx`, `bottom-tab-bar.tsx`, `sidebar-nav.tsx`, `nav-items.ts`, `skeletons.tsx` |
| Global filter (mobile: sheet behind an icon button)                         | `src/components/global-filter.tsx`                                                                                      |
| Search / command palette                                                    | `src/components/command-menu.tsx`, `src/components/ui/command.tsx`, `keyboard-shortcuts.tsx`                            |
| Dialogs → bottom sheet on mobile                                            | `src/components/responsive-dialog.tsx`, `responsive-dialog-impl.tsx` (used by 11 files)                                 |
| Confirmations                                                               | `src/components/confirm-dialog.tsx` (used by 10 files)                                                                  |
| Toasts                                                                      | `src/components/ui/sonner.tsx`, `toast()` in 21 files                                                                   |
| Spinners                                                                    | `Loader2 animate-spin` in 17 files                                                                                      |
| Install hint                                                                | `src/components/install-hint.tsx`                                                                                       |
| Übersicht                                                                   | `src/app/(app)/page.tsx`, `kpi-card.tsx`, `charts/*`, `calendar-month.tsx`, `sparkline.tsx`                             |
| Trades list                                                                 | `src/app/(app)/trades/page.tsx`, `trades/trades-view.tsx` (cards below 1024 px), `trades/trade-card.tsx`                |
| Neuer Trade / bearbeiten (pages)                                            | `src/app/(app)/trades/new/page.tsx`, `trades/[id]/edit/page.tsx`, `trade-form/*`                                        |
| Trade detail                                                                | `src/app/(app)/trades/[id]/page.tsx`, `trade-detail/*`, `lightbox.tsx`                                                  |
| Kalender                                                                    | `src/app/(app)/calendar/page.tsx`, `calendar/calendar-view.tsx`, `calendar-month.tsx`                                   |
| Journal                                                                     | `src/app/(app)/journal/page.tsx`, `journal/[date]/page.tsx`, `journal/*`, `markdown-editor.tsx`                         |
| Statistiken                                                                 | `src/app/(app)/stats/page.tsx`, `stats/stats-view.tsx`, `stat-table.tsx`, `ui/tabs.tsx`                                 |
| Playbooks                                                                   | `src/app/(app)/playbooks/*`, `playbooks/*`                                                                              |
| Konten                                                                      | `src/app/(app)/accounts/page.tsx`, `accounts/*`                                                                         |
| Import/Export                                                               | `src/app/(app)/import-export/page.tsx`, `import-export/*`                                                               |
| Einstellungen                                                               | `src/app/(app)/settings/page.tsx`, `settings/*`, `theme-toggle.tsx`                                                     |
| Mehr                                                                        | `src/app/(app)/more/page.tsx`                                                                                           |
| Login / Setup                                                               | `src/app/(auth)/*`, `auth/*`                                                                                            |
| Errors                                                                      | `src/app/error.tsx`, `global-error.tsx`, `not-found.tsx`                                                                |

Screenshots: `docs/mobile-before/` (iPhone 16 Pro 402 × 874 @3x and iPhone SE 375 × 667 @2x, dark + light, 21 screens).

## 2. Web tells found

1. Full-width tab bar with a raised Material-style "+" button; no floating capsule, no selection pill.
2. Solid sticky top bar with a small title; no large title, no scroll-edge effect, no glass bar buttons.
3. Page transition is a web-style 8 px fade-up for every navigation; no push/pop, no swipe-back.
4. Inter at 14 px body; iOS uses SF at 17 pt and Dynamic Type.
5. Colours are the desktop palette (`#0A0B0F`), not iOS system colours; no grouped backgrounds.
6. Bottom sheets have one height, no detents, no glass, and a web-style footer button bar.
7. Confirmations are sheets with two buttons instead of action sheets.
8. Toasts (Sonner default look) instead of banners/HUD.
9. Circular `Loader2` web spinners in buttons and placeholders with a skeleton pulse.
10. Lists are cards with dividers; no inset-grouped style, no swipe actions, no long-press menus, no pull to refresh.
11. Trade form has a sticky bottom action bar that sits on top of the tab bar.
12. Text on buttons, tabs and rows is selectable and opens the callout on long-press.
13. No launch screens (`apple-touch-startup-image`) → white flash on cold start from the home screen.
14. `theme-color` / manifest colours do not match iOS system backgrounds after the rework (to be updated).
15. Hover: Tailwind 4 already gates `hover:` behind `(hover: hover)`; custom `:hover` CSS is not used. Kept as is,
    and the new iOS layer adds `(pointer: fine)` gating for its own styles.
16. Inputs are 16 px on mobile already (no zoom on focus) – kept.
17. Main content already scrolls on the document and heights use `dvh` – kept.

## 3. Architecture decisions

- **Mobile scope:** every iOS style lives in `src/styles/ios.css` inside `@media (max-width: 767px)` (or in
  `max-md:` utilities / components that only render below 768 px). New components live in `src/components/ios/`.
- **Typography tokens** move from `@theme inline` to a plain `@theme` block, so the mobile scope can override
  `--text-*` variables (desktop values are unchanged).
- **Dynamic Type:** a probe element with `font: -apple-system-body` is measured once; `--dt` (user size / 17 px,
  clamped to 0.82–1.35) scales the mobile text tokens. Spacing stays in px so layouts do not explode.
- **Stack navigation:** instead of intercepting routes + a parallel `@stack` slot (would duplicate every detail
  route and its data loading), the app shell keeps a **DOM snapshot** of the outgoing screen (`cloneNode`, inert,
  frozen at its scroll position) in a per-tab stack. Push/pop animate the real new screen against the snapshot,
  swipe-back drags the real current screen over the snapshot of the previous one, then navigates back. Because the
  snapshot is static DOM it can never re-read the new URL (the "frozen location" rule).
- **Trade form as sheet:** `/trades/new` and `/trades/[id]/edit` stay routes (deep links keep working) but are
  presented as a `large` sheet on mobile over a snapshot of the previous screen (card-stack effect).
- **Toasts → banners:** Sonner stays the API (21 call sites, undo actions); on mobile it is restyled into glass
  capsule banners at the top with swipe-up dismissal. A `CheckmarkHud` is added for successful saves.
- **Haptics:** `<input type="checkbox" switch>` toggle trick (iOS 18+), feature-detected.
- **Testing:** Playwright WebKit cannot be downloaded in the build sandbox (`cdn.playwright.dev` blocked), so local
  verification uses Chromium with iPhone profiles; the WebKit projects run in CI and on the developer's machine.

## 4. Component map (section 10 → files)

| Component                                        | File                                                                                                    | Replaces / used by                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `GlassSurface`, `GlassButton`                    | `src/components/ios/glass.tsx`                                                                          | all glass chrome                              |
| `GlassTabBar`, `FloatingActionButton`            | `src/components/ios/tab-bar.tsx`                                                                        | `bottom-tab-bar.tsx` (mobile)                 |
| `NavBar`, `ScrollEdgeEffect`                     | `src/components/ios/nav-bar.tsx`                                                                        | `top-bar.tsx` (mobile)                        |
| `StackView`, `useSwipeBack`                      | `src/components/ios/stack.tsx`                                                                          | page transition in `app-shell.tsx`            |
| `Sheet`, `SheetHeader`                           | `src/components/ios/sheet.tsx`                                                                          | mobile branch of `responsive-dialog-impl.tsx` |
| `ActionSheet`, `Alert`                           | `src/components/ios/action-sheet.tsx`                                                                   | `confirm-dialog.tsx` (mobile)                 |
| `GlassMenu`, `ContextMenu`, `useLongPress`       | `src/components/ios/menu.tsx`                                                                           | filter / sort / "…" menus, trade rows         |
| `Banner`, `CheckmarkHud`                         | `src/components/ios/banner.tsx`, `ui/sonner.tsx`                                                        | toasts                                        |
| `InsetGroupedList`, `ListSection`, `ListRow`     | `src/components/ios/list.tsx`                                                                           | Mehr, Einstellungen, Konten, detail info      |
| `SwipeableRow`                                   | `src/components/ios/swipeable-row.tsx`                                                                  | `trade-card.tsx`                              |
| `SegmentedControl`, `Switch`, `SearchField`      | `src/components/ios/controls.tsx`                                                                       | range selector, mode switch, settings         |
| `PullToRefresh`, `ActivityIndicator`, `Redacted` | `src/components/ios/feedback.tsx`                                                                       | lists, buttons, skeletons                     |
| `ScrubChart`, `NumberRoll`                       | `src/components/ios/scrub-chart.tsx`, `number-roll.tsx`                                                 | dashboard hero                                |
| `Lightbox`                                       | existing `lightbox.tsx`, extended                                                                       | screenshot gallery                            |
| Hooks                                            | `src/hooks/ios/*` (`useStandalone`, `useScrollDirection`, `useKeyboardInset`, `useReducedTransparency`) |                                               |
| Utils                                            | `src/lib/ios/haptics.ts`, `src/styles/ios.css`                                                          |                                               |

## 5. Milestones

M0 audit (this file) → M1 foundation → M2 Liquid Glass → M3 navigation chrome → M4 stack navigation → M5 modals and
feedback → M6 lists and gestures → M7 screens → M8 accessibility, performance, tests and docs. Each milestone ends
with typecheck, lint, unit tests, build, the desktop pixel diff and a commit; progress notes go to
`docs/MOBILE-IOS.md`.
