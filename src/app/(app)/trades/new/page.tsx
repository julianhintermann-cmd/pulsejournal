import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { newTradeValues } from "@/components/trade-form/initial-values";
import { TradeForm } from "@/components/trade-form/trade-form";
import { Button } from "@/components/ui/button";
import { tradeFormData } from "@/lib/db/queries";
import { getSettings } from "@/lib/settings";
import { resolveTradeMode } from "@/lib/trade-mode";

export const metadata: Metadata = { title: "Neuer Trade" };

export default async function NewTradePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode: modeParam } = await searchParams;
  const settings = getSettings();
  const data = tradeFormData();
  if (data.accounts.length === 0) {
    return (
      <div className="card mx-auto max-w-xl">
        <EmptyState
          icon={Wallet}
          title="Kein aktives Konto"
          description="Lege zuerst ein Konto an, um Trades zu erfassen."
          action={
            <Button asChild>
              <Link href="/accounts">Konto anlegen</Link>
            </Button>
          }
        />
      </div>
    );
  }
  const mode = await resolveTradeMode(modeParam);
  const accountId = data.accounts.find((a) => a.id === settings.defaultAccountId)?.id ?? data.accounts[0].id;
  const initial = newTradeValues({ accountId, mode, timeZone: settings.displayTimezone });
  return (
    <TradeForm
      data={data}
      timeZone={settings.displayTimezone}
      beThreshold={settings.beThreshold}
      defaultRiskPercent={settings.defaultRiskPercent}
      initial={initial}
      tradeId={null}
      initialScreenshots={[]}
    />
  );
}
