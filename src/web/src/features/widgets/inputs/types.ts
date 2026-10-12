import type { ReactNode } from "react";
import type { FilterIds } from "../../filters/filter-ids";

/**
 * One selectable option, the port of evidence's `Option` minus its render
 * id: `value` is the filter-bound form, `label` the optional display text.
 */
export interface OptionItem {
  readonly value: string;
  readonly label?: string;
}

/**
 * A select filter's held value — a bare string in single mode, a list in
 * multi. `selectValueCodec` decodes `?id=v` → `string`, `?id=["a","b"]` →
 * `string[]`, and `undefined`/`""`/`[]` all mean "no param".
 */
export type SelectValue = string | readonly string[];

/**
 * The option-set state `isOptionValueValid` consults — a pending query, an
 * unknown set, or an empty loaded set can never invalidate a held value;
 * only a loaded, non-empty set lacking the value marks it stale.
 */
export interface OptionValidity {
  readonly hasQueryResults: boolean;
  readonly hasStaticOptions: boolean;
  readonly optionsQueryPending?: boolean;
}

/**
 * Props shared by the filter input widgets (`<Dropdown>`, `<MultiSelect>`)
 * and the `FilterSelect` core they both render: `id` names the page filter;
 * `data` + `valueColumn`/`labelColumn` derive options from a ```sql fence
 * (`valueColumn` required when `data` is); `options` supplies static
 * entries when `data` is absent; `filters` cascades other page filters into
 * the option source; `title`/`placeholder` label the field; `search` and
 * `clear` toggle the affordances (both default true); `selectFirst` seeds
 * the first resolved option as a programmatic default.
 */
export interface FilterInputCommonProps {
  readonly id: string;
  readonly data?: string;
  readonly valueColumn?: string;
  readonly labelColumn?: string;
  readonly options?: readonly unknown[];
  readonly filters?: FilterIds;
  readonly title?: string;
  readonly placeholder?: string;
  readonly selectFirst?: boolean;
  readonly search?: boolean;
  readonly clear?: boolean;
}

/** The `FilterSelect` core's internal props — `multiple` is the flag the two MDX tags differ on. */
export interface FilterSelectProps extends FilterInputCommonProps {
  readonly multiple: boolean;
  readonly initialValue?: string | readonly string[];
  readonly defaultTopN?: number;
}

/**
 * The option-list inputs' source-and-value contract, consumed by
 * `useSelectInput` — `<Dropdown>`/`<MultiSelect>` (through `FilterSelect`)
 * and `<ButtonGroup>` share it: `data`+`valueColumn`/`labelColumn` derive
 * options from a ```sql fence, `options` supplies static entries, `filters`
 * cascades page filters into the option source, `multiple` switches the
 * held value between a bare string and a list, and `selectFirst`/
 * `defaultTopN` seed programmatic defaults.
 */
export interface SelectInputProps extends Omit<
  FilterInputCommonProps,
  "title" | "placeholder" | "search" | "clear"
> {
  readonly multiple?: boolean;
  readonly initialValue?: SelectValue;
  readonly defaultTopN?: number;
}

/** Props of the `<Dropdown>` MDX widget — single-select with type-to-search. */
export interface DropdownProps extends FilterInputCommonProps {
  readonly initialValue?: string;
}

/** Props of the `<MultiSelect>` MDX widget — chip-select with `defaultTopN` seeding. */
export interface MultiSelectProps extends FilterInputCommonProps {
  readonly initialValue?: readonly string[];
  readonly defaultTopN?: number;
}

/**
 * Props of the `<ButtonGroup>` MDX widget — the option-list contract minus
 * `defaultTopN` (evidence's button_group has `select_first` only), plus
 * `title` for the group's visible label.
 */
export interface ButtonGroupProps extends Omit<
  SelectInputProps,
  "defaultTopN"
> {
  readonly title?: string;
}

/**
 * A slider filter's held value — a bare number in single mode, an ordered
 * `lo, hi` pair in range mode (`?id=10 - 40` in the URL).
 */
export type SliderValue = number | readonly [number, number];

/**
 * Props of the `<Slider>` MDX widget: `data` + `valueColumn` derive the
 * bounds from a ```sql fence's rows and name the predicate column (without
 * `valueColumn` the value never predicates — `{{params.id}}` consumption
 * only); `min`/`max`/`step` supply or override static bounds; `range`
 * switches to a two-thumb `lo - hi` selection; `filters` cascades other
 * page filters into the bounds source.
 */
export interface SliderProps {
  readonly id: string;
  readonly data?: string;
  readonly valueColumn?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly range?: boolean;
  readonly filters?: FilterIds;
  readonly title?: string;
  readonly initialValue?: number | readonly [number, number];
}

/**
 * Props of the `<TextInput>` MDX widget — a free-text filter input, the
 * port of evidence's `text_input` minus `info`/`icon`/`width`/`flex`.
 * The value never predicates (`column: false`): it persists as `?id=<text>`
 * and is consumed through `{{params.id}}` interpolation only.
 */
export interface TextInputProps {
  readonly id: string;
  readonly title?: string;
  readonly placeholder?: string;
  readonly initialValue?: string;
}

/**
 * Props of the `<DateRange>` MDX widget — a range-expression filter input,
 * the port of evidence's `range_calendar` minus `preset_ranges`,
 * `custom_ranges`, `all_time_range`, `default_range` (ours is
 * `initialValue`) and the calendar grid. The held value is the range
 * expression itself (`'last 30 days'`, `'2026-01-01 to 2026-01-31'`),
 * persisted verbatim in `?id=` so relative windows re-roll on reload.
 * `valueColumn` names the predicate column — without it the value never
 * predicates (`column: false`) and is consumed through `{{params.id}}`.
 */
export interface DateRangeProps {
  readonly id: string;
  readonly title?: string;
  readonly valueColumn?: string;
  readonly initialValue?: string;
}

/**
 * Props of the `<Toggle>` MDX widget — a boolean switch filter input, the
 * port of evidence's `toggle` minus `info`. The value never predicates
 * (`column: false`): `?id=true`/`?id=false` IS the emitted boolean —
 * `invert` flips the stored value, so the switch's checked face is
 * `value XOR invert`. Consumed through `{{params.id}}` only.
 */
export interface ToggleProps {
  readonly id: string;
  readonly label?: string;
  readonly invert?: boolean;
  readonly initialValue?: boolean;
}

/**
 * Props of the `<FilterBar>` MDX widget — a presentational container for
 * the filter inputs (evidence's `filter_bar`): the children lay out as one
 * horizontal bar that sticks under the page header on scroll and gains a
 * floating card style once its rest position leaves the viewport. The bar
 * carries no props of its own and stores no filter value — children keep
 * their `?id=` writes and `filters=[...]` predicates; docked, it counts the
 * children whose filter is applied.
 */
export interface FilterBarProps {
  readonly children?: ReactNode;
}
