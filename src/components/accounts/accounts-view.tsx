"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowDownLeft,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { CashDialog } from "@/components/accounts/cash-dialog";
import { useApp } from "@/components/app-context";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { PnlValue } from "@/components/pnl-value";
import { Sparkline } from "@/components/sparkline";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import type { AccountSummary } from "@/lib/db/queries";
import { cashDelta } from "@/lib/stats/metrics";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS, CASH_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { deleteAccount, setAccountArchived } from "@/server/actions/accounts";
import { deleteCashTransaction } from "@/server/actions/cash";

function AccountCard({
  account,
  onEdit,
  onCash,
  onDelete,
}: {
  account: AccountSummary;
  onEdit: () => void;
  onCash: () => void;
  onDelete: () => void;
}) {
  const { timeZone } = useApp();
  const [showCash, setShowCash] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggleArchive = () =>
    startTransition(async () => {
      const result = await setAccountArchived(account.id, !account.archived);
      if (result.ok) toast.success(account.archived ? "Konto wiederhergestellt" : "Konto archiviert");
      else toast.error(result.error);
    });

  const removeCash = (id: string) =>
    startTransition(async () => {
      const result = await deleteCashTransaction(id);
      if (result.ok) toast.success("Buchung gelöscht");
      else toast.error(result.error);
    });

  return (
    <article
      className={cn(
        "card flex flex-col overflow-hidden transition-colors md:hover:border-surface-3",
        account.archived && "opacity-70",
      )}
    >
      <div className="h-1" style={{ backgroundColor: account.color }} />
      <div className="flex flex-col gap-4 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-h3">{account.name}</h2>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {ACCOUNT_TYPE_LABELS[account.type]}
              </span>
              {account.archived ? (
                <span className="rounded-full bg-be-soft px-2 py-0.5 text-[11px] font-semibold text-be">
                  Archiviert
                </span>
              ) : null}
            </div>
            <p className="truncate text-small text-muted-foreground">
              {[account.broker, account.currency].filter(Boolean).join(" · ")}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Aktionen" disabled={pending}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> Bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onCash}>
                <ArrowDownLeft /> Ein-/Auszahlung erfassen
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={toggleArchive}>
                {account.archived ? <ArchiveRestore /> : <Archive />}
                {account.archived ? "Wiederherstellen" : "Archivieren"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDelete} className="text-loss focus:text-loss">
                <Trash2 className="text-loss" /> Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-small tracking-[0.04em] text-muted-foreground uppercase">Kontostand</span>
            <span className="text-kpi-sm tabular-nums md:text-kpi">
              {formatMoney(account.balance, account.currency)}
            </span>
            <span className="flex items-center gap-2 text-small text-muted-foreground">
              <span
                className={cn(
                  "tabular-nums",
                  account.returnPct != null && account.returnPct > 0 && "text-profit",
                  account.returnPct != null && account.returnPct < 0 && "text-loss",
                )}
              >
                {account.returnPct != null ? formatPercent(account.returnPct, { signed: true }) : "n/a"}
              </span>
              seit Start · {account.trades} Trades
            </span>
          </div>
          <div className="w-28 shrink-0 md:w-36">
            <Sparkline values={account.curve} height={44} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={onCash}>
            <ArrowDownLeft /> Buchung
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/trades?account=${account.id}&range=all`}>Trades</Link>
          </Button>
        </div>

        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowCash((v) => !v)}
            className="flex w-full items-center justify-between text-small text-muted-foreground hover:text-foreground"
            aria-expanded={showCash}
          >
            <span>Buchungen ({account.cash.length})</span>
            <ChevronDown className={cn("size-4 transition-transform", showCash && "rotate-180")} />
          </button>
          {showCash ? (
            account.cash.length === 0 ? (
              <p className="pt-3 text-small text-faint">Noch keine Ein- oder Auszahlungen.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border pt-2">
                {account.cash.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[13px] font-medium">{CASH_TYPE_LABELS[c.type]}</span>
                      <span className="truncate text-small text-faint">
                        {formatDate(c.occurredAt, timeZone)}
                        {c.note ? ` · ${c.note}` : ""}
                      </span>
                    </div>
                    <PnlValue value={cashDelta(c)} currency={account.currency} className="text-[13px] font-medium" />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Buchung löschen"
                      onClick={() => removeCash(c.id)}
                      disabled={pending}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function AccountsView({
  accounts,
  showArchived,
  hasArchived,
}: {
  accounts: AccountSummary[];
  showArchived: boolean;
  hasArchived: boolean;
}) {
  const { baseCurrency } = useApp();
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountSummary | null>(null);
  const [cashFor, setCashFor] = useState<AccountSummary | null>(null);
  const [deleting, setDeleting] = useState<AccountSummary | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleArchived = (checked: boolean) => router.push(checked ? "/accounts?archived=1" : "/accounts");

  const confirmDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteAccount(deleting.id);
      if (result.ok) {
        toast.success("Konto gelöscht");
        setDeleting(null);
      } else toast.error(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-muted-foreground">{accounts.filter((a) => !a.archived).length} aktive Konten</p>
        <div className="flex items-center gap-4">
          {hasArchived || showArchived ? (
            <label className="flex items-center gap-2 text-small text-muted-foreground">
              <Switch checked={showArchived} onCheckedChange={toggleArchived} />
              Archivierte anzeigen
            </label>
          ) : null}
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Neues Konto
          </Button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Wallet}
            title="Keine Konten"
            description="Lege ein Konto an, um Trades zu erfassen."
            action={
              <Button onClick={() => setFormOpen(true)}>
                <Plus /> Neues Konto
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={() => {
                setEditing(account);
                setFormOpen(true);
              }}
              onCash={() => setCashFor(account)}
              onDelete={() => setDeleting(account)}
            />
          ))}
        </div>
      )}

      <AccountFormDialog open={formOpen} onOpenChange={setFormOpen} account={editing} baseCurrency={baseCurrency} />
      {cashFor ? (
        <CashDialog
          open={cashFor != null}
          onOpenChange={(open) => !open && setCashFor(null)}
          accountId={cashFor.id}
          accountName={cashFor.name}
          currency={cashFor.currency}
        />
      ) : null}
      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Konto wirklich löschen?"
        description={`„${deleting?.name ?? ""}“ wird mit allen ${deleting?.trades ?? 0} Trades, Screenshots und Buchungen entfernt. Das kann nicht rückgängig gemacht werden.`}
        confirmLabel="Konto löschen"
        destructive
        pending={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
