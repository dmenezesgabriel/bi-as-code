import { useMemo, type ReactElement } from "react";
import { Combobox } from "../../../components/combobox";
import { titleCase } from "./option-items";
import {
  MultiSelectField,
  SelectPopup,
  SingleSelectField,
  type SelectFieldProps,
} from "./select-fields";
import type { FilterSelectProps } from "./types";
import { toSelectionArray, useSelectInput } from "./use-select-input";

/**
 * The combobox core shared by `<Dropdown>` and `<MultiSelect>`
 * (`multiple` switches the selection shape): `data`+`valueColumn` derive
 * options from a ```sql fence — filtered live by the `filters` cascade —
 * while `options` supplies static entries (prop wins over rows on a shared
 * value, evidence's `combinedOptions` precedence). The bound page filter
 * carries the `valueColumn` predicate and the array-tolerant URL codec, so
 * `?id=West` and `?id=["a","b"]` both decode; a stale URL value clears only
 * once a loaded, non-empty option set proves it stale — pending or empty
 * sets keep it (evidence's four validation states). The field rendering
 * per mode lives in `select-fields.tsx`; the option-source + value
 * lifecycle this shares with `<ButtonGroup>` lives in `use-select-input.ts`.
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
  multiple,
  defaultTopN,
}: FilterSelectProps): ReactElement {
  const { filter, items, loading, failure } = useSelectInput({
    id,
    data,
    valueColumn,
    labelColumn,
    options,
    filters,
    initialValue,
    multiple,
    selectFirst,
    defaultTopN,
  });
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

  if (failure) return failure;

  const resolvedPlaceholder =
    placeholder ??
    (valueColumn ? `Select ${titleCase(valueColumn)}` : "Select Option");
  const labelFor = (value: string): string =>
    items.find((item) => item.value === value)?.label ?? value;
  const selectAll = (values: readonly string[]): void => {
    if (!filter) return;
    filter.value = [...new Set([...toSelectionArray(rawValue), ...values])];
  };
  const shared: SelectFieldProps = {
    id,
    title,
    filter,
    collection,
    loading,
    placeholder: resolvedPlaceholder,
    labelFor,
    popup: (
      <SelectPopup
        label={title ?? resolvedPlaceholder}
        search={!multiple && search}
        clear={clear}
        onSelectAll={multiple ? selectAll : undefined}
      />
    ),
  };
  if (multiple) {
    return (
      <MultiSelectField
        {...shared}
        search={search}
        values={toSelectionArray(rawValue)}
      />
    );
  }
  return <SingleSelectField {...shared} value={singleValue || null} />;
}
