import type { ReactElement } from "react";
import { FilterSelect } from "./filter-select";
import type { DropdownProps } from "./types";

/**
 * The `<Dropdown>` MDX widget — a single-select filter input with
 * type-to-search inside its popup. `data`+`valueColumn` derive the option
 * list from a ```sql fence, `options` supplies static entries when `data`
 * is absent, `filters` cascades other page filters into the option source,
 * and the selection writes `?id=value` to the URL so a reload or shared
 * link restores it.
 *
 * @example
 * <Dropdown id="region" data="orders" valueColumn="region" title="Region" />
 * <Dropdown id="status" options={["open", "closed"]} />
 */
export function Dropdown(props: DropdownProps): ReactElement {
  return <FilterSelect {...props} multiple={false} />;
}
