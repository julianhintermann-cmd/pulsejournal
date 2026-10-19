import type { Metadata } from "next";

import { AccountsView } from "@/components/accounts/accounts-view";
import { accountSummaries } from "@/lib/db/queries";

export const metadata: Metadata = { title: "Konten" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const all = accountSummaries({ includeArchived: true });
  const accounts = showArchived ? all : all.filter((a) => !a.archived);
  return <AccountsView accounts={accounts} showArchived={showArchived} hasArchived={all.some((a) => a.archived)} />;
}
