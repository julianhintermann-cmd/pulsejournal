import type { Metadata } from "next";

import { PlaybooksView } from "@/components/playbooks/playbooks-view";
import { getFilter, type SearchParams } from "@/lib/filter-server";
import { playbookCards } from "@/lib/playbooks";

export const metadata: Metadata = { title: "Playbooks" };

export default async function PlaybooksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filter = await getFilter(params);
  const showArchived = params.archived === "1";
  const all = playbookCards(filter, true);
  const cards = showArchived ? all : all.filter((c) => !c.archived);
  return <PlaybooksView cards={cards} showArchived={showArchived} hasArchived={all.some((c) => c.archived)} />;
}
