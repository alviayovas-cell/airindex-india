import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { TableRowSkeleton } from "@/components/common/Skeleton";

export interface Column<Row> {
  key: string;
  header: string;
  /** cell renderer */
  render: (row: Row) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
}

export interface SortState {
  key: string;
  order: "asc" | "desc";
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  loading,
  skeletonRows = 8,
  empty,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  sort?: SortState;
  onSortChange?: (s: SortState) => void;
  loading?: boolean;
  skeletonRows?: number;
  empty?: ReactNode;
}) {
  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    if (sort?.key === key) {
      onSortChange({ key, order: sort.order === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ key, order: "desc" });
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  !col.align && "text-left",
                )}
              >
                {col.sortable && onSortChange ? (
                  <button
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-foreground",
                      col.align === "right" && "flex-row-reverse",
                    )}
                  >
                    {col.header}
                    {sort?.key === col.key ? (
                      sort.order === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRowSkeleton key={i} cols={columns.length} />
              ))
            : rows.length === 0
              ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center">
                    {empty ?? (
                      <span className="text-sm text-muted-foreground">No rows found.</span>
                    )}
                  </td>
                </tr>
              )
              : rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "whitespace-nowrap px-4 py-3 text-foreground",
                          col.align === "right" && "text-right tabular-nums",
                          col.align === "center" && "text-center",
                          col.className,
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
        </tbody>
      </table>
    </div>
  );
}
