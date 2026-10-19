const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type Entry = { failures: number; firstAt: number };

const globalForLimit = globalThis as unknown as { __pulseLoginLimit?: Map<string, Entry> };
const attempts = (globalForLimit.__pulseLoginLimit ??= new Map<string, Entry>());

function current(ip: string, now: number) {
  const entry = attempts.get(ip);
  if (entry && now - entry.firstAt > WINDOW_MS) {
    attempts.delete(ip);
    return undefined;
  }
  return entry;
}

/** True when the IP has used up its 5 failed attempts in the current 15-minute window. */
export function isRateLimited(ip: string, now = Date.now()) {
  return (current(ip, now)?.failures ?? 0) >= MAX_FAILURES;
}

export function recordFailure(ip: string, now = Date.now()) {
  const entry = current(ip, now);
  if (entry) entry.failures += 1;
  else attempts.set(ip, { failures: 1, firstAt: now });
}

export function clearFailures(ip: string) {
  attempts.delete(ip);
}
