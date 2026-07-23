"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { comparePublicLabels } from "@/lib/i18n/presentation";

/**
 * Reusable sortable data table. Extends the `DataTable` primitive family by
 * composing the same canonical `editorial-data-table` classes (see
 * `src/app/editorial.css`) and adding client-side, click-a-header sorting.
 * The static `<DataTable>` remains the server-safe primitive; this is the
 * interactive sibling for data surfaces (rankings, comparisons).
 *
 * Design-system rules honoured:
 *  - numeric columns use `.num` (right-aligned, tabular figures);
 *  - a missing cell value renders an em-dash, never a crash;
 *  - headers are the canonical uppercase-Inter table headers;
 *  - the whole table is meant to sit inside `.editorial-table-scroll`
 *    so wide content scrolls INSIDE the container, not the page.
 */

export type SortableColumn<Row> = {
  /** Stable column id. */
  id: string;
  /** Header label. */
  label: ReactNode;
  /** Numeric column → right-aligned tabular figures + numeric sort. */
  numeric?: boolean;
  /** Sort key: the comparable value for a row, or null when absent
   *  (absent rows always sort to the bottom regardless of direction). */
  sortValue?: (row: Row) => number | string | null;
  /** Cell renderer. Return null/undefined to render the em-dash. */
  render: (row: Row) => ReactNode;
  /** Optional provenance / unit node shown under the header label. */
  meta?: ReactNode;
  /** Fixed width hint (design token string), e.g. "var(--space-8)". */
  width?: string;
};

type SortState = { columnId: string; direction: "asc" | "desc" };

const EM_DASH = "—";

export function SortableDataTable<Row>({
  columns,
  rows,
  getRowKey,
  initialSort,
  className,
  caption,
}: {
  columns: SortableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row, index: number) => string;
  /** Default sort. Falls back to the first sortable column, descending. */
  initialSort?: SortState;
  className?: string;
  caption?: string;
}) {
  const firstSortable = columns.find((c) => c.sortValue);
  const [sort, setSort] = useState<SortState>(
    initialSort ??
      (firstSortable
        ? { columnId: firstSortable.id, direction: "desc" }
        : { columnId: columns[0]?.id ?? "", direction: "desc" }),
  );

  const sortedRows = useMemo(() => {
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return rows;
    const dir = sort.direction === "asc" ? 1 : -1;
    const getValue = column.sortValue;
    return [...rows].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      // Missing values always sink to the bottom, both directions.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return comparePublicLabels(String(av), String(bv)) * dir;
    });
  }, [columns, rows, sort]);

  const toggleSort = (column: SortableColumn<Row>) => {
    if (!column.sortValue) return;
    setSort((prev) =>
      prev.columnId === column.id
        ? { columnId: column.id, direction: prev.direction === "asc" ? "desc" : "asc" }
        : // Numeric columns default to descending (largest first);
          // text columns default to ascending (A→Z).
          { columnId: column.id, direction: column.numeric ? "desc" : "asc" },
    );
  };

  return (
    <table className={`editorial-data-table sortable-data-table${className ? ` ${className}` : ""}`}>
      {caption && <caption className="sortable-data-table__caption">{caption}</caption>}
      <thead>
        <tr>
          {columns.map((column) => {
            const isSorted = sort.columnId === column.id;
            const sortable = Boolean(column.sortValue);
            return (
              <th
                key={column.id}
                className={column.numeric ? "num" : undefined}
                style={column.width ? { width: column.width } : undefined}
                aria-sort={
                  isSorted
                    ? sort.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : sortable
                      ? "none"
                      : undefined
                }
              >
                {sortable ? (
                  <button
                    type="button"
                    className={`sortable-data-table__sort${isSorted ? " sortable-data-table__sort--active" : ""}`}
                    onClick={() => toggleSort(column)}
                  >
                    <span className="sortable-data-table__label">
                      {column.label}
                      {column.meta}
                    </span>
                    <ChevronDown
                      size={13}
                      aria-hidden
                      className={`sortable-data-table__chevron${
                        isSorted && sort.direction === "asc"
                          ? " sortable-data-table__chevron--asc"
                          : ""
                      }${isSorted ? " sortable-data-table__chevron--active" : ""}`}
                    />
                  </button>
                ) : (
                  <span className="sortable-data-table__label">
                    {column.label}
                    {column.meta}
                  </span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row, index) => (
          <tr key={getRowKey(row, index)}>
            {columns.map((column) => {
              const content = column.render(row);
              const isEmpty =
                content == null || content === "" || content === false;
              return (
                <td key={column.id} className={column.numeric ? "num" : undefined}>
                  {isEmpty ? (
                    <span className="sortable-data-table__empty" aria-label="No data">
                      {EM_DASH}
                    </span>
                  ) : (
                    content
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
