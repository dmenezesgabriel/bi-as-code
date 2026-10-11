import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "../../../components/icons";
import { cn } from "../../../lib/cn";
import type { Row } from "../../data/types";
import { nextSort, sortRows } from "./sort-rows";
import { TableEmpty } from "./states";
import { defaultTableColumns } from "./table-columns";
import type { Sort, TableColumn } from "./types";

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
 * formatted text.
 *
 * @example
 * <DataTable rows={result.rows} pageSize={25} />
 * <DataTable rows={result.rows} columns={resolveTableColumns(result.rows, specs)} />
 */
export function DataTable({
  rows,
  pageSize = 10,
  columns,
}: {
  rows: readonly Row[];
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
        <table className="w-full border-collapse text-sm">
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
                {shown.map((column) => {
                  const value = row[column.id];
                  return (
                    <td
                      key={column.id}
                      className={cn(
                        "border-b border-neutral-200 py-1 pr-4 dark:border-neutral-800",
                        (typeof value === "number" ||
                          typeof value === "bigint") &&
                          "text-right",
                      )}
                    >
                      {column.format(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <TablePager
          current={current}
          pageCount={pageCount}
          totalRows={rows.length}
          onPage={setPage}
        />
      )}
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
      className="border-b border-neutral-300 py-1 pr-4 text-left font-medium dark:border-neutral-700"
    >
      <button
        type="button"
        onClick={() => onSort(column.id)}
        className="flex items-center gap-1"
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

function TablePager({
  current,
  pageCount,
  totalRows,
  onPage,
}: {
  current: number;
  pageCount: number;
  totalRows: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-xs text-neutral-500 dark:text-neutral-400">
      <span>
        Page {current + 1} of {pageCount} · {totalRows} rows
      </span>
      <div className="flex items-center">
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
      </div>
    </div>
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
      className="rounded p-1 text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-neutral-400 dark:hover:bg-neutral-800 dark:disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
