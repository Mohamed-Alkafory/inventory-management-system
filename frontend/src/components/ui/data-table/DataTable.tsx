import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "../../../lib/cn";
import EmptyState from "../EmptyState";
import ErrorState from "../ErrorState";
import { Skeleton } from "../Skeleton";
import DataTablePagination from "./DataTablePagination";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataTableColumn<TData> = ColumnDef<TData, any>;

export type DataTableProps<TData> = {
  columns: DataTableColumn<TData>[];
  data: TData[];
  /** Accessible table name (visually hidden). */
  caption?: string;
  getRowId?: (row: TData, index: number) => string;

  /** Rendered in a trailing "Actions" column, e.g. edit / delete buttons. */
  rowActions?: (row: TData) => ReactNode;

  loading?: boolean;
  /** Error message; shows the error state instead of rows. */
  error?: string | null;
  onRetry?: () => void;
  /** Replaces the default empty state. */
  empty?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;

  /** Initial page size (client-side) — default 10. */
  pageSize?: number;
  pageSizeOptions?: number[];

  /**
   * Server-side mode. Pass `pageCount` (and `totalRows`) to page on the server,
   * and/or `sorting` + `onSortingChange` to sort on the server.
   * Control `pagination` / `onPaginationChange` to react to page changes.
   */
  pageCount?: number;
  totalRows?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
};

const DEFAULT_PAGE_SIZES = [10, 20, 50];

export default function DataTable<TData>({
  columns,
  data,
  caption,
  getRowId,
  rowActions,
  loading = false,
  error,
  onRetry,
  empty,
  emptyTitle = "No results",
  emptyDescription = "There is nothing to show here yet.",
  pageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  pageCount,
  totalRows,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
}: DataTableProps<TData>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const manualPagination = pageCount !== undefined;
  const manualSorting = sorting !== undefined && onSortingChange !== undefined;

  const activeSorting = sorting ?? internalSorting;
  const activePagination = pagination ?? internalPagination;

  const allColumns = useMemo<DataTableColumn<TData>[]>(() => {
    if (!rowActions) return columns;
    const actionsColumn: DataTableColumn<TData> = {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => <div className="flex justify-end gap-2">{rowActions(row.original)}</div>,
    };
    return [...columns, actionsColumn];
  }, [columns, rowActions]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table's API returns functions by design; handled via its own internal caching
  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    state: { sorting: activeSorting, pagination: activePagination },
    onSortingChange: onSortingChange ?? setInternalSorting,
    onPaginationChange: onPaginationChange ?? setInternalPagination,
    manualSorting,
    manualPagination,
    pageCount,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const total = totalRows ?? data.length;
  const colSpan = allColumns.length;
  const showError = Boolean(error);
  const showEmpty = !loading && !showError && rows.length === 0;
  const showPagination = !loading && !showError && total > 0;

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}

          <thead className="bg-surface-alt text-xs font-semibold uppercase tracking-wide text-muted">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        canSort ? (sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none") : undefined
                      }
                      className="px-4 py-3 whitespace-nowrap"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 uppercase tracking-wide transition hover:text-ink focus-visible:outline-2 focus-visible:outline-primary-500"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5" aria-hidden="true" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden="true" />
                          )}
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

          <tbody className="divide-y divide-line">
            {loading &&
              Array.from({ length: Math.min(activePagination.pageSize, 5) }, (_, i) => (
                <tr key={`skeleton-${i}`} aria-hidden="true">
                  {allColumns.map((_, c) => (
                    <td key={c} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))}

            {showError && (
              <tr>
                <td colSpan={colSpan}>
                  <ErrorState message={error ?? undefined} onRetry={onRetry} />
                </td>
              </tr>
            )}

            {showEmpty && (
              <tr>
                <td colSpan={colSpan}>
                  {empty ?? <EmptyState title={emptyTitle} description={emptyDescription} />}
                </td>
              </tr>
            )}

            {!loading &&
              !showError &&
              rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-slate-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cn("px-4 py-3.5 text-ink", cell.column.id === "actions" && "text-right")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {loading && <span className="sr-only" role="status">Loading…</span>}

      {showPagination && (
        <DataTablePagination
          pageIndex={activePagination.pageIndex}
          pageCount={Math.max(table.getPageCount(), 1)}
          pageSize={activePagination.pageSize}
          pageSizeOptions={pageSizeOptions}
          totalRows={total}
          onPageChange={(index) => table.setPageIndex(index)}
          onPageSizeChange={(size) => table.setPageSize(size)}
        />
      )}
    </div>
  );
}
