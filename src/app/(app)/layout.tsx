import { cookies } from "next/headers";

import { AppProvider } from "@/components/app-context";
import { AppShell, SIDEBAR_COOKIE } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/guard";
import { listAccounts } from "@/lib/db/queries";
import { getPersistedFilter } from "@/lib/filter-server";
import { getSettings } from "@/lib/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = getSettings();
  const accounts = listAccounts().map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    color: a.color,
    type: a.type,
  }));
  const store = await cookies();
  const collapsed = store.get(SIDEBAR_COOKIE)?.value === "collapsed";
  const persistedFilter = await getPersistedFilter();

  return (
    <AppProvider
      value={{
        username: user.username,
        timeZone: settings.displayTimezone,
        baseCurrency: settings.baseCurrency,
        weekStartsOn: settings.weekStartsOn,
        theme: settings.theme,
        accounts,
        persistedFilter,
      }}
    >
      <AppShell initialCollapsed={collapsed}>{children}</AppShell>
    </AppProvider>
  );
}
