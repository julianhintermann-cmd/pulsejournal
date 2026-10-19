import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { tradeToValues } from "@/components/trade-form/initial-values";
import { TradeForm } from "@/components/trade-form/trade-form";
import { getTradeDetail, tradeFormData } from "@/lib/db/queries";
import { getSettings } from "@/lib/settings";
import { resolveTradeMode } from "@/lib/trade-mode";
import { uploadUrl } from "@/lib/upload-url";

export const metadata: Metadata = { title: "Trade bearbeiten" };

export default async function EditTradePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const { mode: modeParam } = await searchParams;
  const detail = getTradeDetail(id);
  if (!detail) notFound();
  const settings = getSettings();
  const data = tradeFormData();
  // The trade's own (possibly archived) account must stay selectable.
  if (!data.accounts.some((a) => a.id === detail.account.id)) {
    data.accounts.push({
      id: detail.account.id,
      name: detail.account.name,
      currency: detail.account.currency,
      balance: detail.account.startingBalance,
    });
  }
  if (detail.playbook && !data.playbooks.some((p) => p.id === detail.playbook?.id)) {
    data.playbooks.push({
      id: detail.playbook.id,
      name: detail.playbook.name,
      color: detail.playbook.color,
      rules: detail.rules.map((r) => ({ id: r.id, text: r.text })),
    });
  }
  const mode = await resolveTradeMode(modeParam);
  const initial = tradeToValues(detail, { mode, timeZone: settings.displayTimezone });
  return (
    <TradeForm
      data={data}
      timeZone={settings.displayTimezone}
      beThreshold={settings.beThreshold}
      defaultRiskPercent={settings.defaultRiskPercent}
      initial={initial}
      tradeId={id}
      initialScreenshots={detail.screenshots.map((s) => ({
        key: s.id,
        id: s.id,
        previewUrl: uploadUrl(s.thumbPath),
        caption: s.caption ?? "",
      }))}
    />
  );
}
