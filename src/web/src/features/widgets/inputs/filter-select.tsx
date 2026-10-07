import { useEffect, useMemo, type ReactElement } from "react";
import { Combobox } from "../../../components/combobox";
import {
  CheckIcon,
  ChevronDownIcon,
  LoaderCircleIcon,
  SearchIcon,
} from "../../../components/icons";
import { useFilteredQueryRows } from "../../filters/use-filtered-query-rows";
import { usePageFilter } from "../../filters/use-page-filter";
import {
  isOptionValueValid,
  mergeOptionItems,
  parseOptionsProp,
  titleCase,
  toOptionItems,
} from "./option-items";
import { WidgetError } from "../markdown/states";
import type { FilterSelectProps, OptionItem } from "./types";
import { selectValueCodec } from "./value-codec";

import type { QueryResult } from "../../pages/types";

/** Case-insensitive substring match over value and label — evidence's `filteredOptions`. */
function matchOption(item: OptionItem, query: string): boolean {
  const q = query.toLowerCase();
  return (
    item.value.toLowerCase().includes(q) ||
    (item.label?.toLowerCase().includes(q) ?? false)
  );
}

/**
 * The blocking option-source failure for `data`-backed inputs — the same
 * inline, page-surviving treatment as `<Table>`: a missing `valueColumn`,
 * an undeclared fence name, or a query error replaces the field with an
 * alert. `null` when the source is usable.
 */
function sourceError({
  data,
  valueColumn,
  result,
  id,
}: {
  data: string | undefined;
  valueColumn: string | undefined;
  result: QueryResult | undefined;
  id: string;
}): ReactElement | null {
  if (data === undefined) return null;
  if (valueColumn === undefined) {
    return (
      <WidgetError
        name={id}
        message="data is set — valueColumn is required to name the options' value column"
      />
    );
  }
  if (result === undefined) {
    return (
      <WidgetError
        name={data}
        message="no sql fence on this page declares this name"
      />
    );
  }
  if (result.status === "error") {
    return <WidgetError name={data} message={result.message} />;
  }
  return null;
}

/**
 * The combobox core shared by `<Dropdown>` and `<MultiSelect>`
 * (`multiple` switches the selection shape): `data`+`valueColumn` derive
 * options from a ```sql fence — filtered live by the `filters` cascade —
 * while `options` supplies static entries (prop wins over rows on a shared
 * value, evidence's `combinedOptions` precedence). The bound page filter
 * carries the `valueColumn` predicate and the array-tolerant URL codec, so
 * `?id=West` and `?id=["a","b"]` both decode; a stale URL value clears only
 * once a loaded, non-empty option set proves it stale — pending or empty
 * sets keep it (evidence's four validation states).
 *
 * @example
 * <FilterSelect id="region" data="orders" valueColumn="region" title="Region" multiple={false} />
 */
export function FilterSelect({
  id,
  data,
  valueColumn,
  labelColumn,
  options,
  filters,
  title,
  placeholder,
  selectFirst = false,
  search = true,
  clear = true,
  initialValue,
}: FilterSelectProps): ReactElement {
  const result = useFilteredQueryRows(data ?? "", filters);
  const filter = usePageFilter<string | readonly string[]>(id, {
    column: valueColumn,
    ...selectValueCodec,
    initialValue,
  });

  const dataMode = data !== undefined;
  const queryPending = dataMode && result?.status !== "success";

  const staticItems = useMemo(() => parseOptionsProp(options), [options]);
  const rows =
    dataMode && result?.status === "success" ? result.rows : undefined;
  const rowItems = useMemo(
    () =>
      rows !== undefined && valueColumn !== undefined
        ? toOptionItems(rows, valueColumn, labelColumn)
        : [],
    [rows, valueColumn, labelColumn],
  );
  const items = useMemo(
    () => mergeOptionItems(staticItems, rowItems),
    [staticItems, rowItems],
  );
  const availableValues = useMemo(
    () => new Set(items.map((item) => item.value)),
    [items],
  );
  const collection = useMemo(
    () =>
      Combobox.createItems(items, {
        getValue: (item) => item.value,
        getLabel: (item) => item.label ?? item.value,
      }),
    [items],
  );

  const rawValue = filter?.value;
  const singleValue = typeof rawValue === "string" ? rawValue : undefined;

  // Value coherence against the live option set, one pass: an array URL
  // param decodes under the shared codec and a single-select keeps element
  // 0; a loaded, non-empty option set that lacks the value clears it
  // through `normalize` (pending/empty sets keep it, evidence's four
  // validation states); a still-empty filter takes the `selectFirst` seed —
  // `!== undefined`, so a cleared "" never snaps back (evidence's
  // truthiness guard re-fired).
  useEffect(() => {
    if (!filter) return;
    if (Array.isArray(rawValue)) {
      filter.normalize(rawValue[0] ?? "");
      return;
    }
    const valid = isOptionValueValid(singleValue, availableValues, {
      hasQueryResults: dataMode && result?.status === "success",
      hasStaticOptions: staticItems.length > 0,
      optionsQueryPending: queryPending,
    });
    if (!valid) {
      filter.normalize("");
      return;
    }
    if (!selectFirst || items.length === 0 || rawValue !== undefined) return;
    filter.setDefault(items[0]!.value);
  }, [
    filter,
    rawValue,
    singleValue,
    availableValues,
    dataMode,
    result?.status,
    staticItems,
    queryPending,
    selectFirst,
    items,
  ]);

  const failure = sourceError({ data, valueColumn, result, id });
  if (failure) return failure;

  const loading = result?.status === "loading";
  const resolvedPlaceholder =
    placeholder ??
    (valueColumn ? `Select ${titleCase(valueColumn)}` : "Select Option");
  const labelFor = (value: string): string =>
    items.find((item) => item.value === value)?.label ?? value;

  return (
    <div className="relative mb-4 max-w-72">
      <Combobox.Root
        items={collection}
        value={
          singleValue === undefined || singleValue === "" ? null : singleValue
        }
        onValueChange={(value: string | null) => {
          if (filter) filter.value = value ?? "";
        }}
        filter={matchOption}
        disabled={loading || !filter}
      >
        {title !== undefined && (
          <Combobox.Label className="mb-1 block cursor-default text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {title}
          </Combobox.Label>
        )}
        <Combobox.Trigger
          id={id}
          className="flex h-8 w-full cursor-default items-center justify-between gap-2 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 select-none hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-60 data-placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:data-placeholder:text-neutral-400"
        >
          <Combobox.Value>
            {(value: string | null) =>
              value == null ? resolvedPlaceholder : labelFor(value)
            }
          </Combobox.Value>
          {loading ? (
            <LoaderCircleIcon className="shrink-0 text-neutral-500" />
          ) : (
            <Combobox.Icon className="shrink-0 text-neutral-500">
              <ChevronDownIcon />
            </Combobox.Icon>
          )}
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner
            align="start"
            sideOffset={4}
            className="z-50 outline-none"
          >
            <SelectPopup
              label={title ?? resolvedPlaceholder}
              search={search}
              clear={clear}
            />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}

/**
 * The option surface: search field (evidence's type-to-search, `search={false}`
 * hides it), the item list with a `"No options found"` empty face, and the
 * footer `Clear` (`clear={false}` hides it — base-ui self-hides it anyway
 * when nothing is selected).
 */
function SelectPopup({
  label,
  search,
  clear,
}: {
  label: string;
  search: boolean;
  clear: boolean;
}): ReactElement {
  return (
    <Combobox.Popup
      aria-label={label}
      className="w-[var(--anchor-width)] min-w-40 overflow-hidden rounded-md border border-neutral-300 bg-white text-sm text-neutral-900 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
    >
      {search && (
        <div className="flex items-center gap-1 border-b border-neutral-200 pr-2 dark:border-neutral-700">
          <SearchIcon className="ml-2 shrink-0 text-neutral-400" />
          <Combobox.Input
            aria-label="Search"
            placeholder="Search"
            className="h-8 w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-500 dark:text-neutral-100 dark:placeholder:text-neutral-400"
          />
        </div>
      )}
      <Combobox.Empty>
        <div className="px-2 py-1.5 text-sm text-neutral-500 dark:text-neutral-400">
          No options found
        </div>
      </Combobox.Empty>
      <Combobox.List className="max-h-[min(24.5rem,var(--available-height))] overflow-y-auto overscroll-contain py-1 data-empty:p-0">
        {(item: OptionItem) => (
          <Combobox.Item
            key={item.value}
            value={item.value}
            className="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-neutral-100 dark:data-highlighted:bg-neutral-800"
          >
            <Combobox.ItemIndicator className="col-start-1">
              <CheckIcon />
            </Combobox.ItemIndicator>
            <span className="col-start-2 truncate">
              {item.label ?? item.value}
            </span>
          </Combobox.Item>
        )}
      </Combobox.List>
      {clear && (
        <div className="border-t border-neutral-200 dark:border-neutral-700">
          <Combobox.Clear className="w-full cursor-default px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 data-[visible]:not-last:border-b-0 dark:text-neutral-300 dark:hover:bg-neutral-800">
            Clear
          </Combobox.Clear>
        </div>
      )}
    </Combobox.Popup>
  );
}
