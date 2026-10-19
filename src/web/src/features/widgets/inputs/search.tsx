import type { ReactElement } from "react";
import type { Filter } from "../../filters/filter";
import { usePageFilter } from "../../filters/use-page-filter";
import { DraftTextField } from "./draft-text-field";
import { FIELD_CONTROL_HEIGHT } from "./field-line";
import { titleCase } from "./option-items";
import { searchClause } from "./search-clause";
import { formatMatchCount, useSearchMatchCount } from "./search-count";
import { sourceError } from "./source-error";
import type { SearchProps } from "./types";

/**
 * The `<Search>` MDX widget — mosaic's `Search` input: the typed text
 * persists as `?id=<text>` and publishes a case-insensitive match on
 * `column` (`method` `contains`, `prefix` or `suffix`; default `contains`)
 * to every widget listing `id` in its `filters`, so no fence hand-writes
 * the `ilike`. It searches one column, where Observable Inputs' `search`
 * matches across every column. Typing commits like `<TextInput>`: after
 * ~300ms of quiet, or at once on blur/Enter. With `data`, an `<output>`
 * beside the box counts that fence's rows under `filters` and the search
 * itself — Observable Inputs' "N results" line; an unknown fence or a
 * failing one replaces the field with an alert.
 *
 * @example
 * <Search id="q" column="region" title="Search regions" data="order_detail" filters={["region"]} />
 */
export function Search(props: SearchProps): ReactElement {
  const { id, column, method, initialValue, data, filters } = props;
  const filter = usePageFilter<string>(id, {
    column,
    clause: searchClause(method ?? "contains"),
    initialValue: initialValue || undefined,
  });
  const match = useSearchMatchCount(data ?? "", filters, id);
  const failure = sourceError({
    data,
    valueColumn: column,
    result: match.result,
    id,
    valueColumnFor: "searched",
  });
  if (failure) return failure;
  if (data === undefined) return <SearchField {...props} filter={filter} />;
  return (
    <div className="flex flex-wrap items-end gap-x-2">
      <SearchField {...props} filter={filter} />
      <MatchCount id={id} count={match.count} pending={match.pending} />
    </div>
  );
}

/** The search box itself — `type="search"` gives it the `searchbox` role. */
function SearchField({
  id,
  title,
  placeholder,
  filter,
}: SearchProps & {
  readonly filter: Filter<string> | undefined;
}): ReactElement {
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

/**
 * The count line: `<output>` is an implicit `status` live region, so a
 * screen reader hears each new count. Empty until the first count lands;
 * `aria-busy` while a newer one is on its way.
 */
function MatchCount({
  id,
  count,
  pending,
}: {
  readonly id: string;
  readonly count: number | undefined;
  readonly pending: boolean;
}): ReactElement {
  return (
    <output
      htmlFor={id}
      aria-live="polite"
      aria-busy={pending}
      // A floor width keeps the inputs after it still while the count's text
      // changes length under typing ("355 matches" ↔ "No matches").
      className={`${FIELD_CONTROL_HEIGHT} flex min-w-24 items-center whitespace-nowrap text-sm tabular-nums text-muted-foreground`}
    >
      {count === undefined ? "" : formatMatchCount(count)}
    </output>
  );
}
