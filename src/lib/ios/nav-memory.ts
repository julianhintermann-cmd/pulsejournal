import type { TabKey } from "@/lib/ios/nav";

/**
 * Per-tab navigation memory for the phone layout: the last screen of every tab (its stack top) and the scroll
 * position of every visited screen, so switching tabs returns to exactly where the user left (section 4.1).
 * Kept in memory and mirrored to sessionStorage for reloads.
 */

const KEY = "pulse.nav";
type State = { last: Partial<Record<TabKey, string>>; scroll: Record<string, number> };

let state: State | null = null;

function load(): State {
  if (state) return state;
  try {
    state = JSON.parse(sessionStorage.getItem(KEY) ?? "") as State;
  } catch {
    state = null;
  }
  if (!state || typeof state !== "object") state = { last: {}, scroll: {} };
  state.last ??= {};
  state.scroll ??= {};
  return state;
}

let saveTimer = 0;
function persist() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(load()));
    } catch {
      // storage full or unavailable: memory only
    }
  }, 250);
}

export function rememberScreen(tab: TabKey, url: string) {
  load().last[tab] = url;
  persist();
}

export function lastScreen(tab: TabKey): string | undefined {
  return load().last[tab];
}

export function rememberScroll(url: string, y: number) {
  const s = load();
  s.scroll[url] = Math.max(0, Math.round(y));
  // Bound the map: drop the oldest entries.
  const keys = Object.keys(s.scroll);
  if (keys.length > 80) for (const k of keys.slice(0, keys.length - 80)) delete s.scroll[k];
  persist();
}

export function savedScroll(url: string): number | undefined {
  return load().scroll[url];
}

/** A tab switch asks the shell to restore this URL's scroll position after the next render. */
let pendingRestore: string | null = null;
export function requestScrollRestore(url: string) {
  pendingRestore = url;
}
export function takeScrollRestore(url: string): number | null {
  if (pendingRestore !== url) return null;
  pendingRestore = null;
  return savedScroll(url) ?? 0;
}

/** The screen shown before the current one (for the back button: pop when it is the parent). */
let previous: string | null = null;
let current: string | null = null;
export function trackScreen(pathname: string) {
  if (pathname === current) return;
  previous = current;
  current = pathname;
}
export function previousScreen() {
  return previous;
}
