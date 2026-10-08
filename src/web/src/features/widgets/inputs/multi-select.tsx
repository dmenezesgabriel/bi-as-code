import type { ReactElement } from "react";
import { FilterSelect } from "./filter-select";
import type { MultiSelectProps } from "./types";

/**
 * The `<MultiSelect>` MDX widget — a multi-select filter input whose
 * chosen values render as removable chips in the field; typing in the
 * field narrows the option list. `data`+`valueColumn` derive the option
 * list from a ```sql fence, `options` supplies static entries when `data`
 * is absent, `filters` cascades other page filters into the option
 * source, `defaultTopN` seeds the first N resolved options as a
 * programmatic default, and the selection writes `?id=["a","b"]` to the
 * URL so a reload or shared link restores it.
 *
 * @example
 * <MultiSelect id="channel" data="channel_mix" valueColumn="channel" title="Channel" />
 * <MultiSelect id="tags" options={["a", "b", "c"]} defaultTopN={2} />
 */
export function MultiSelect(props: MultiSelectProps): ReactElement {
  return <FilterSelect {...props} multiple />;
}
