"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { AccountType, Theme } from "@/lib/db/schema";
import { FILTER_COOKIE, FILTER_STORAGE_KEY } from "@/lib/filter";

export type ShellAccount = { id: string; name: string; currency: string; color: string; type: AccountType };

export type AppContextValue = {
  username: string;
  timeZone: string;
  baseCurrency: string;
  weekStartsOn: number;
  theme: Theme;
  accounts: ShellAccount[];
  /** Last persisted filter query string (mirrors the cookie); URL params take precedence. */
  persistedFilter: string | null;
  setPersistedFilter: (query: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  value,
  children,
}: {
  value: Omit<AppContextValue, "setPersistedFilter">;
  children: React.ReactNode;
}) {
  const [persistedFilter, setPersisted] = useState(value.persistedFilter);
  const setPersistedFilter = useCallback((query: string) => {
    setPersisted(query);
    document.cookie = `${FILTER_COOKIE}=${encodeURIComponent(query)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, query);
    } catch {
      // Storage may be unavailable (private mode); the cookie still persists the filter.
    }
  }, []);
  const ctx = useMemo(
    () => ({ ...value, persistedFilter, setPersistedFilter }),
    [value, persistedFilter, setPersistedFilter],
  );
  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
