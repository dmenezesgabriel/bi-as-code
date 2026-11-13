import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  DownloadIcon,
} from "../../../components/icons";
import { cn } from "../../../lib/cn";
import type { Row } from "../../data/types";
import { saveCsv } from "./save-csv";
import { nextSort, sortRows } from "./sort-rows";
import { TableEmpty } from "./states";
import { defaultTableColumns } from "./table-columns";
import { toCsv } from "./table-csv";
import type { ColumnAlign, Sort, TableColumn } from "./types";

const ALIGN_CLASS: Record<ColumnAlign, string> = {
  left: "text-left",
  right: "text-right",
};

/**
 * The table's presentational core: renders already-materialized `rows`
 * with header-click sorting (none → desc → asc → none, tracked by
 * `aria-sort` on the `th`) and page-size pagination. Everything is
 * component-local — sort and page reset on reload, and a sort change
 * returns to the first page. Consumers with a `QueryResult` union handle
 * loading/error themselves through `./states`; `rows` empty renders the
 * shared empty state here. `columns` picks, orders, titles and formats
 * what shows; without it every column shows under its humanized name with
 * numbers as `num0`. Sort always compares the raw values, never the
 * formatted text. A download button under the table saves every row, in
 * the current sort order and under the shown column titles, as
 * `<downloadName>.csv`.
 *
 * @example
 * <DataTable rows={result.rows} downloadName="orders" pageSize={25} />
 * <DataTable rows={result.rows} downloadName="orders" columns={resolveTableColumns(result.rows, specs)} />
 */
export function DataTable({
  rows,
  downloadName,
  pageSize = 10,
  columns,
}: {
  rows: readonly Row[];
  downloadName: string;
  pageSize?: number;
  columns?: readonly TableColumn[];
}) {
  const [sort, setSort] = useState<Sort | null>(null);
  const [page, setPage] = useState(0);
  const sorted = useMemo(
    () => (sort === null ? rows : sortRows(rows, sort)),
    [rows, sort],
  );

  if (rows.length === 0) return <TableEmpty />;

  const shown = columns ?? defaultTableColumns(rows);
  const pageCount = Math.ceil(rows.length / pageSize);
  // `page` can outlive the data: when a `{{params}}` re-run shrinks `rows`,
  // the view clamps to the last available page instead of rendering nothing.
  const current = Math.min(page, pageCount - 1);
  const visible = sorted.slice(current * pageSize, (current + 1) * pageSize);

  const onSort = (column: string) => {
    setSort((prev) => nextSort(prev, column));
    setPage(0);
  };

  return (
    <div className="py-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm tabular-nums">
          <thead>
            <tr>
              {shown.map((column) => (
                <SortableHeader
                  key={column.id}
                  column={column}
                  sort={sort}
                  onSort={onSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              // A sql result row has no stable id and may duplicate another
              // row byte-for-byte, so position is its identity — the result
              // set re-renders wholesale on every new QueryResult.
              // eslint-disable-next-line react-doctor/no-array-index-as-key
              <tr key={index}>
                {shown.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      "border-b border-border py-1 pr-4",
                      ALIGN_CLASS[column.align],
                    )}
                  >
                    {column.format(row[column.id])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TableFooter
        current={current}
        pageCount={pageCount}
        totalRows={rows.length}
        onPage={setPage}
        onDownload={() => saveCsv(`${downloadName}.csv`, toCsv(sorted, shown))}
      />
    </div>
  );
}

function SortableHeader({
  column,
  sort,
  onSort,
}: {
  column: TableColumn;
  sort: Sort | null;
  onSort: (column: string) => void;
}) {
  const active = sort?.column === column.id ? sort.direction : null;
  return (
    <th
      aria-sort={ariaSortValue(active)}
      className={cn(
        "border-b border-border-strong py-1 pr-4 font-medium",
        ALIGN_CLASS[column.align],
      )}
    >
      {/* A right-aligned header leads with its glyph so the title's edge
          sits flush over the figures below, whatever glyph the sort shows.
          The button repeats the column's alignment: a <button> centres its
          own lines, so a wrapped title would drift off the column's edge. */}
      <button
        type="button"
        onClick={() => onSort(column.id)}
        className={cn(
          "inline-flex items-center gap-1 focus-visible:-outline-offset-2",
          ALIGN_CLASS[column.align],
          column.align === "right" && "flex-row-reverse",
        )}
      >
        {column.title}
        <SortGlyph direction={active} />
      </button>
    </th>
  );
}

function ariaSortValue(
  active: Sort["direction"] | null,
): "none" | "ascending" | "descending" {
  if (active === "desc") return "descending";
  if (active === "asc") return "ascending";
  return "none";
}

function SortGlyph({ direction }: { direction: Sort["direction"] | null }) {
  if (direction === "desc") return <ArrowDownIcon />;
  if (direction === "asc") return <ArrowUpIcon />;
  return <ArrowUpDownIcon className="opacity-40" />;
}

/**
 * The row under the table: the pager (only past one page) and the download
 * button, which stays at the right edge whatever the page count.
 */
function TableFooter({
  current,
  pageCount,
  totalRows,
  onPage,
  onDownload,
}: {
  current: number;
  pageCount: number;
  totalRows: number;
  onPage: (page: number) => void;
  onDownload: () => void;
}) {
  const paged = pageCount > 1;
  return (
    <div className="flex items-center justify-between py-1 text-xs text-muted-foreground-faded">
      {paged && (
        <span>
          Page {current + 1} of {pageCount} · {totalRows} rows
        </span>
      )}
      <div className="ml-auto flex items-center">
        {paged && (
          <PagerButtons
            current={current}
            pageCount={pageCount}
            onPage={onPage}
          />
        )}
        <PagerButton label="Download CSV" disabled={false} onClick={onDownload}>
          <DownloadIcon />
        </PagerButton>
      </div>
    </div>
  );
}

function PagerButtons({
  current,
  pageCount,
  onPage,
}: {
  current: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <>
      <PagerButton
        label="First page"
        disabled={current === 0}
        onClick={() => onPage(0)}
      >
        <ChevronsLeftIcon />
      </PagerButton>
      <PagerButton
        label="Previous page"
        disabled={current === 0}
        onClick={() => onPage(current - 1)}
      >
        <ChevronLeftIcon />
      </PagerButton>
      <PagerButton
        label="Next page"
        disabled={current === pageCount - 1}
        onClick={() => onPage(current + 1)}
      >
        <ChevronRightIcon />
      </PagerButton>
      <PagerButton
        label="Last page"
        disabled={current === pageCount - 1}
        onClick={() => onPage(pageCount - 1)}
      >
        <ChevronsRightIcon />
      </PagerButton>
    </>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
