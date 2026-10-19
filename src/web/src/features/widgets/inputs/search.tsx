import type { ReactElement } from "react";
import { usePageFilter } from "../../filters/use-page-filter";
import { DraftTextField } from "./draft-text-field";
import { titleCase } from "./option-items";
import { searchClause } from "./search-clause";
import type { SearchProps } from "./types";

/**
 * The `<Search>` MDX widget — mosaic's `Search` input: the typed text
 * persists as `?id=<text>` and publishes a case-insensitive match on
 * `column` (`method` `contains`, `prefix` or `suffix`; default `contains`)
 * to every widget listing `id` in its `filters`, so no fence hand-writes
 * the `ilike`. It searches one column, where Observable Inputs' `search`
 * matches across every column. Typing commits like `<TextInput>`: after
 * ~300ms of quiet, or at once on blur/Enter.
 *
 * @example
 * <Search id="q" column="region" title="Search regions" />
 */
export function Search({
  id,
  column,
  method,
  title,
  placeholder,
  initialValue,
}: SearchProps): ReactElement {
  const filter = usePageFilter<string>(id, {
    column,
    clause: searchClause(method ?? "contains"),
    initialValue: initialValue || undefined,
  });
  return (
    <DraftTextField
      id={id}
      label={title ?? titleCase(id)}
      placeholder={placeholder ?? "Search"}
      type="search"
      filter={filter}
    />
  );
}
