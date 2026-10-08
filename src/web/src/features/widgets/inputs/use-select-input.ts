import { useEffect, useMemo, type ReactElement } from "react";
import type { Filter } from "../../filters/filter";
import { useFilteredQueryRows } from "../../filters/use-filtered-query-rows";
import { usePageFilter } from "../../filters/use-page-filter";
import {
  isOptionValueValid,
  mergeOptionItems,
  parseOptionsProp,
  toOptionItems,
} from "./option-items";
import { sourceError } from "./source-error";
import type {
  OptionItem,
  OptionValidity,
  SelectInputProps,
  SelectValue,
} from "./types";
import { selectValueCodec } from "./value-codec";

/**
 * What `useSelectInput` hands each option-list input — the bound page
 * filter (undefined outside a `FiltersProvider`), the merged
 * static+row-derived options, the pending flag, and the inline source-error
 * element to render instead of the field.
 */
export interface SelectInputState {
  readonly filter: Filter<SelectValue> | undefined;
  readonly items: OptionItem[];
  readonly loading: boolean;
  readonly failure: ReactElement | null;
}

/**
 * The option-source + value core shared by every option-list filter input
 * (`<Dropdown>`/`<MultiSelect>` through `FilterSelect`, `<ButtonGroup>`):
 * `data`+`valueColumn` derive options from a ```sql fence — filtered live
 * by the `filters` cascade — while `options` supplies static entries (prop
 * wins over rows on a shared value, evidence's `combinedOptions`
 * precedence). The bound page filter carries the `valueColumn` predicate
 * and the array-tolerant URL codec, so `?id=West` and `?id=["a","b"]` both
 * decode; a stale URL value clears only once a loaded, non-empty option set
 * proves it stale — pending or empty sets keep it (evidence's four
 * validation states). Rendering stays with the caller.
 *
 * @example
 * const { filter, items, loading, failure } = useSelectInput(props);
 * if (failure) return failure;
 */
export function useSelectInput({
  id,
  data,
  valueColumn,
  labelColumn,
  options,
  filters,
  initialValue,
  multiple = false,
  selectFirst = false,
  defaultTopN,
}: SelectInputProps): SelectInputState {
  const result = useFilteredQueryRows(data ?? "", filters);
  const filter = usePageFilter<SelectValue>(id, {
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

  const rawValue = filter?.value;

  // Value coherence against the live option set, one pass per mode — the
  // reconcile helpers carry each mode's staleness and seeding rules.
  useEffect(() => {
    if (!filter) return;
    const gate: OptionValidity = {
      hasQueryResults: dataMode && result?.status === "success",
      hasStaticOptions: staticItems.length > 0,
      optionsQueryPending: queryPending,
    };
    if (multiple) {
      reconcileMultiValue(
        filter,
        rawValue,
        items,
        availableValues,
        gate,
        selectFirst,
        defaultTopN,
      );
      return;
    }
    reconcileSingleValue(
      filter,
      rawValue,
      items,
      availableValues,
      gate,
      selectFirst,
    );
  }, [
    filter,
    rawValue,
    availableValues,
    dataMode,
    result?.status,
    staticItems,
    queryPending,
    selectFirst,
    items,
    multiple,
    defaultTopN,
  ]);

  return {
    filter,
    items,
    loading: result?.status === "loading",
    failure: sourceError({
      data,
      valueColumn,
      result,
      id,
      valueColumnFor: "options' value",
    }),
  };
}

/**
 * Multi-mode value coherence: a bare `?id=v` wraps into the canonical `[v]`
 * (the URL rewrites as JSON on the way through); a held array drops only the
 * entries a loaded, non-empty option set proves stale; `defaultTopN` (or
 * `selectFirst`'s 1) seeds through `setDefault`, so a cleared `[]` and a
 * URL-held value both block seeding.
 */
function reconcileMultiValue(
  filter: Filter<SelectValue>,
  rawValue: SelectValue | undefined,
  items: readonly OptionItem[],
  availableValues: ReadonlySet<string>,
  gate: OptionValidity,
  selectFirst: boolean,
  defaultTopN: number | undefined,
): void {
  if (typeof rawValue === "string") {
    filter.normalize(rawValue === "" ? [] : [rawValue]);
    return;
  }
  if (rawValue !== undefined && rawValue.length > 0) {
    const kept = rawValue.filter((value) =>
      isOptionValueValid(value, availableValues, gate),
    );
    if (kept.length !== rawValue.length) filter.normalize(kept);
    return;
  }
  if (rawValue !== undefined) return;
  const seedCount = defaultTopN ?? (selectFirst ? 1 : 0);
  if (seedCount <= 0 || items.length === 0) return;
  filter.setDefault(items.slice(0, seedCount).map((item) => item.value));
}

/**
 * Single-mode value coherence: an array param keeps element 0; a loaded,
 * non-empty option set lacking the value clears it through `normalize`
 * (pending/empty sets keep it — evidence's four validation states); a
 * still-empty filter takes the `selectFirst` seed — `!== undefined`, so a
 * cleared "" never snaps back.
 */
function reconcileSingleValue(
  filter: Filter<SelectValue>,
  rawValue: SelectValue | undefined,
  items: readonly OptionItem[],
  availableValues: ReadonlySet<string>,
  gate: OptionValidity,
  selectFirst: boolean,
): void {
  // `typeof` narrows where `Array.isArray` can't — a `readonly string[]`
  // union member survives isArray's `any[]` narrowing.
  if (rawValue !== undefined && typeof rawValue !== "string") {
    filter.normalize(rawValue[0] ?? "");
    return;
  }
  if (!isOptionValueValid(rawValue, availableValues, gate)) {
    filter.normalize("");
    return;
  }
  if (!selectFirst || items.length === 0 || rawValue !== undefined) return;
  filter.setDefault(items[0]!.value);
}

/** `SelectValue | undefined` → a pressed-value list ("" means none). */
export function toSelectionArray(raw: SelectValue | undefined): string[] {
  if (raw === undefined || typeof raw === "string") return raw ? [raw] : [];
  return [...raw];
}
