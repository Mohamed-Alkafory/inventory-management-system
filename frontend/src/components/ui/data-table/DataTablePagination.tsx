import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../../lib/cn";
import Select from "../Select";
import { getPageRange } from "./page-range";

type Props = {
  /** Zero-based current page. */
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions: number[];
  totalRows: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

const pageButton =
  "inline-flex size-9 items-center justify-center rounded-control text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-40";

export default function DataTablePagination({
  pageIndex,
  pageCount,
  pageSize,
  pageSizeOptions,
  totalRows,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const current = pageIndex + 1;
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(totalRows, (pageIndex + 1) * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-line px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <p>
          Showing <span className="font-semibold text-ink">{from}–{to}</span> of{" "}
          <span className="font-semibold text-ink">{totalRows}</span>
        </p>
        <Select
          aria-label="Rows per page"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="py-1.5"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </Select>
      </div>

      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={pageIndex <= 0}
          onClick={() => onPageChange(pageIndex - 1)}
          className={cn(pageButton, "text-slate-700 hover:bg-slate-100")}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>

        {getPageRange(current, pageCount).map((item) =>
          typeof item === "number" ? (
            <button
              key={item}
              type="button"
              aria-label={`Page ${item}`}
              aria-current={item === current ? "page" : undefined}
              onClick={() => onPageChange(item - 1)}
              className={cn(
                pageButton,
                item === current ? "bg-primary-600 text-white" : "text-slate-700 hover:bg-slate-100",
              )}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="px-1 text-slate-400" aria-hidden="true">
              …
            </span>
          ),
        )}

        <button
          type="button"
          aria-label="Next page"
          disabled={pageIndex >= pageCount - 1}
          onClick={() => onPageChange(pageIndex + 1)}
          className={cn(pageButton, "text-slate-700 hover:bg-slate-100")}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
