"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Columns3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useApp } from "@/components/app-context";
import { DirectionChip } from "@/components/direction-chip";
import { PnlValue } from "@/components/pnl-value";
import { ResultChip } from "@/components/result-chip";
import { RValue } from "@/components/r-value";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TradeRow } from "@/lib/db/queries";
import { formatDateTime, formatDecimal, formatPrice } from "@/lib/format";
import { SESSION_LABELS } from "@/lib/sessions";
import { cn } from "@/lib/utils";

const VISIBILITY_KEY = "pulse.tradeColumns";
const VIRTUALIZE_ABOVE = 200;

const COLUMN_LABELS: Record<string, string> = {
  openedAt: "Datum",
  symbol: "Symbol",
  direction: "Richtung",
  setup: "Setup",
  session: "Session",
  entryAvg: "Einstieg",
  exitAvg: "Ausstieg",
  qty: "Menge",
  rMultiple: "R",
  netPnl: "Netto P&L",
  result: "Ergebnis",
  tags: "Tags",
};

function nullsLast(a: number | null, b: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

export function TradesTable({
  rows,
  compact,
  selection,
  onSelectionChange,
}: {
  rows: TradeRow[];
  compact: boolean;
  selection: RowSelectionState;
  onSelectionChange: (selection: RowSelectionState) => void;
}) {
  const router = useRouter();
  const { timeZone } = useApp();
  const [sorting, setSorting] = useState<SortingState>([{ id: "openedAt", desc: true }]);
  const [visibility, setVisibility] = useState<VisibilityState>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VISIBILITY_KEY);

      if (stored) setVisibility(JSON.parse(stored) as VisibilityState);
    } catch {
      // ignore unavailable storage
    }
  }, []);

  const updateVisibility = (next: VisibilityState) => {
    setVisibility(next);
    try {
      localStorage.setItem(VISIBILITY_KEY, JSON.stringify(next));
    } catch {
      // ignore unavailable storage
    }
  };

  const columns = useMemo<ColumnDef<TradeRow>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        enableHiding: false,
        size: 44,
        header: ({ table }) => (
          <Checkbox
            aria-label="Alle auswählen"
            checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
            onCheckedChange={(v) => table.toggleAllRowsSelected(v === true)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label="Trade auswählen"
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(v === true)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        id: "openedAt",
        accessorKey: "openedAt",
        header: "Datum",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">{formatDateTime(row.original.openedAt, timeZone)}</span>
        ),
      },
      {
        id: "symbol",
        accessorKey: "symbol",
        header: "Symbol",
        cell: ({ row }) => <span className="font-semibold">{row.original.symbol}</span>,
      },
      {
        id: "direction",
        accessorKey: "direction",
        header: "Richtung",
        cell: ({ row }) => <DirectionChip direction={row.original.direction} size="sm" />,
      },
      {
        id: "setup",
        accessorFn: (r) => r.playbook?.name ?? "",
        header: "Setup",
        cell: ({ row }) =>
          row.original.playbook ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: row.original.playbook.color }} />
              <span className="max-w-36 truncate">{row.original.playbook.name}</span>
            </span>
          ) : (
            <span className="text-faint">–</span>
          ),
      },
      {
        id: "session",
        accessorKey: "session",
        header: "Session",
        cell: ({ row }) => <span className="text-muted-foreground">{SESSION_LABELS[row.original.session]}</span>,
      },
      {
        id: "entryAvg",
        accessorKey: "entryAvg",
        header: "Einstieg",
        sortingFn: (a, b) => nullsLast(a.original.entryAvg, b.original.entryAvg),
        cell: ({ row }) => <span className="tabular-nums">{formatPrice(row.original.entryAvg)}</span>,
        meta: { align: "right" },
      },
      {
        id: "exitAvg",
        accessorKey: "exitAvg",
        header: "Ausstieg",
        sortingFn: (a, b) => nullsLast(a.original.exitAvg, b.original.exitAvg),
        cell: ({ row }) => <span className="tabular-nums">{formatPrice(row.original.exitAvg)}</span>,
        meta: { align: "right" },
      },
      {
        id: "qty",
        accessorKey: "qty",
        header: "Menge",
        cell: ({ row }) => <span className="tabular-nums">{formatDecimal(row.original.qty, 4)}</span>,
        meta: { align: "right" },
      },
      {
        id: "rMultiple",
        accessorKey: "rMultiple",
        header: "R",
        sortingFn: (a, b) => nullsLast(a.original.rMultiple, b.original.rMultiple),
        cell: ({ row }) => <RValue value={row.original.rMultiple} className="font-medium" />,
        meta: { align: "right" },
      },
      {
        id: "netPnl",
        accessorKey: "netPnl",
        header: "Netto P&L",
        sortingFn: (a, b) => nullsLast(a.original.netPnl, b.original.netPnl),
        cell: ({ row }) =>
          row.original.netPnl != null ? (
            <PnlValue value={row.original.netPnl} currency={row.original.currency} className="font-semibold" />
          ) : (
            <span className="text-faint">–</span>
          ),
        meta: { align: "right" },
      },
      {
        id: "result",
        accessorKey: "result",
        header: "Ergebnis",
        cell: ({ row }) => <ResultChip result={row.original.result} size="sm" />,
      },
      {
        id: "tags",
        accessorFn: (r) => r.tags.map((t) => t.name).join(", "),
        header: "Tags",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex max-w-48 flex-wrap gap-1">
            {row.original.tags.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className="inline-flex h-5 items-center gap-1 rounded-full bg-surface-2 px-2 text-[11px] font-medium"
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}
              </span>
            ))}
            {row.original.tags.length > 3 ? (
              <span className="text-[11px] text-faint">+{row.original.tags.length - 3}</span>
            ) : null}
          </span>
        ),
      },
    ],
    [timeZone],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions by design
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility: visibility, rowSelection: selection },
    getRowId: (r) => r.id,
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) =>
      updateVisibility(typeof updater === "function" ? updater(visibility) : updater),
    onRowSelectionChange: (updater) => onSelectionChange(typeof updater === "function" ? updater(selection) : updater),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
  });

  const tableRows = table.getRowModel().rows;
  const virtualize = tableRows.length > VIRTUALIZE_ABOVE;
  const rowHeight = compact ? 40 : 52;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const el = containerRef.current;

    if (el) setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
  }, [virtualize]);
  const virtualizer = useWindowVirtualizer({
    count: tableRows.length,
    estimateSize: () => rowHeight,
    overscan: 12,
    scrollMargin,
    enabled: virtualize,
  });
  const virtualItems = virtualize ? virtualizer.getVirtualItems() : [];
  const rendered = virtualize ? virtualItems.map((v) => tableRows[v.index]) : tableRows;
  const padTop = virtualize && virtualItems.length > 0 ? virtualItems[0].start - virtualizer.options.scrollMargin : 0;
  const padBottom =
    virtualize && virtualItems.length > 0
      ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1].end - virtualizer.options.scrollMargin)
      : 0;
  const visibleCount = table.getVisibleLeafColumns().length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Columns3 /> Spalten
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllLeafColumns()
              .filter((c) => c.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(v === true)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {COLUMN_LABELS[column.id] ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div ref={containerRef} className="card overflow-x-auto xl:overflow-x-clip">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead className="z-10 xl:sticky xl:top-[calc(env(safe-area-inset-top)+64px)]">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const align = (header.column.columnDef.meta as { align?: string } | undefined)?.align;
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={cn(
                        "h-10 border-b border-border bg-surface px-3 text-left text-small font-medium whitespace-nowrap text-muted-foreground first:rounded-tl-card last:rounded-tr-card",
                        align === "right" && "text-right",
                        header.column.id === "select" && "w-11",
                      )}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-foreground",
                            sorted && "text-foreground",
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : null}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {padTop > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={visibleCount} style={{ height: padTop }} />
              </tr>
            ) : null}
            {rendered.map((row) => (
              <tr
                key={row.id}
                onClick={() => router.push(`/trades/${row.original.id}`)}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-surface-2/70",
                  row.getIsSelected() && "bg-accent-soft hover:bg-accent-soft",
                )}
                style={{ height: rowHeight }}
              >
                {row.getVisibleCells().map((cell) => {
                  const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align;
                  return (
                    <td
                      key={cell.id}
                      className={cn("border-b border-border px-3 whitespace-nowrap", align === "right" && "text-right")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
            {padBottom > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={visibleCount} style={{ height: padBottom }} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
