import type { ReactElement } from "react";
import {
  Combobox,
  type ComboboxItemCollection,
} from "../../../components/combobox";
import {
  CheckIcon,
  ChevronDownIcon,
  LoaderCircleIcon,
  SearchIcon,
  XIcon,
} from "../../../components/icons";
import type { Filter } from "../../filters/filter";
import type { OptionItem, SelectValue } from "./types";

/** Case-insensitive substring match over value and label — evidence's `filteredOptions`. */
function matchOption(item: OptionItem, query: string): boolean {
  const q = query.toLowerCase();
  return (
    item.value.toLowerCase().includes(q) ||
    (item.label?.toLowerCase().includes(q) ?? false)
  );
}

/** The inputs every field rendering shares — the rest differ per mode. */
export interface SelectFieldProps {
  readonly id: string;
  readonly title: string | undefined;
  readonly filter: Filter<SelectValue> | undefined;
  readonly collection: ComboboxItemCollection<OptionItem, string>;
  readonly loading: boolean;
  readonly placeholder: string;
  readonly labelFor: (value: string) => string;
  readonly popup: ReactElement;
}

/**
 * The multi-select field — base-ui's canonical chips layout: `Chips` inside
 * `InputGroup` holds one `Chip` per selection plus the `Input`, so typing
 * narrows the list, the popup stays open across picks, and Backspace on an
 * empty input removes the last chip. A native `<label htmlFor>` replaces
 * `Combobox.Label`, which console-errors when the input lives outside the
 * popup.
 */
export function MultiSelectField({
  id,
  title,
  filter,
  collection,
  loading,
  placeholder,
  labelFor,
  popup,
  search,
  values,
}: SelectFieldProps & {
  readonly search: boolean;
  readonly values: string[];
}): ReactElement {
  return (
    <div className="relative mb-4 max-w-72">
      <Combobox.Root
        items={collection}
        multiple
        value={values}
        onValueChange={(next: string[]) => {
          if (filter) filter.value = next;
        }}
        onOpenChange={(open, details) => {
          // Stay open across picks — and because the cancel returns before
          // base-ui's input-clear runs, the typed query survives too
          // (evidence's pick-several-from-one-search UX).
          if (!open && details.reason === "item-press") details.cancel();
        }}
        filter={matchOption}
        disabled={loading || !filter}
      >
        {title !== undefined && (
          <label
            htmlFor={id}
            className="mb-1 block cursor-default text-sm font-medium text-label"
          >
            {title}
          </label>
        )}
        <Combobox.InputGroup className="flex min-h-8 w-full cursor-text flex-wrap items-center gap-1 rounded-md border border-input bg-field px-2 py-1 text-sm text-foreground select-none hover:bg-accent focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-60">
          <Combobox.Value>
            {(selected: readonly string[]) => (
              <SelectionChips
                values={selected}
                title={title}
                labelFor={labelFor}
                inputId={id}
                search={search}
                placeholder={placeholder}
              />
            )}
          </Combobox.Value>
          {loading ? (
            <LoaderCircleIcon className="ml-auto shrink-0 self-center text-muted-foreground-faded" />
          ) : (
            <Combobox.Icon className="ml-auto shrink-0 self-center text-muted-foreground-faded">
              <ChevronDownIcon />
            </Combobox.Icon>
          )}
        </Combobox.InputGroup>
        {popup}
      </Combobox.Root>
    </div>
  );
}

/**
 * The single-select field — a readonly trigger button whose `Combobox.Value`
 * shows the label (the popup carries the search input), and `Combobox.Label`
 * binds the title to the trigger.
 */
export function SingleSelectField({
  id,
  title,
  filter,
  collection,
  loading,
  placeholder,
  labelFor,
  popup,
  value,
}: SelectFieldProps & { readonly value: string | null }): ReactElement {
  return (
    <div className="relative mb-4 max-w-72">
      <Combobox.Root
        items={collection}
        value={value}
        onValueChange={(next: string | null) => {
          if (filter) filter.value = next ?? "";
        }}
        filter={matchOption}
        disabled={loading || !filter}
      >
        {title !== undefined && (
          <Combobox.Label className="mb-1 block cursor-default text-sm font-medium text-label">
            {title}
          </Combobox.Label>
        )}
        <Combobox.Trigger
          id={id}
          className="flex h-8 w-full cursor-default items-center justify-between gap-2 rounded-md border border-input bg-field px-2 text-sm text-foreground select-none hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 data-placeholder:text-muted-foreground-faded"
        >
          <Combobox.Value>
            {(selected: string | null) =>
              selected == null ? placeholder : labelFor(selected)
            }
          </Combobox.Value>
          {loading ? (
            <LoaderCircleIcon className="shrink-0 text-muted-foreground-faded" />
          ) : (
            <Combobox.Icon className="shrink-0 text-muted-foreground-faded">
              <ChevronDownIcon />
            </Combobox.Icon>
          )}
        </Combobox.Trigger>
        {popup}
      </Combobox.Root>
    </div>
  );
}

/**
 * The multi-select field's chip row — base-ui's canonical `Chips` layout
 * (chips and the field input share one container, so typing filters and
 * Backspace on an empty input removes the last chip). Renders at most four
 * chips — three plus a `+N more` count — evidence's badge cap. The
 * `aria-*` strings are the ones base-ui documents but does not ship.
 */
function SelectionChips({
  values,
  title,
  labelFor,
  inputId,
  search,
  placeholder,
}: {
  values: readonly string[];
  title: string | undefined;
  labelFor: (value: string) => string;
  inputId: string;
  search: boolean;
  placeholder: string;
}): ReactElement {
  const shown = values.length > 4 ? values.slice(0, 3) : values;
  return (
    <Combobox.Chips
      className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
      aria-label={
        values.length > 0 ? `Selected ${title ?? "options"}` : undefined
      }
    >
      {shown.map((value) => (
        <Combobox.Chip
          key={value}
          aria-label={labelFor(value)}
          aria-description="Press Backspace or Delete to remove"
          className="flex h-5 items-center gap-1 rounded bg-accent pr-0.5 pl-1.5 text-xs text-accent-foreground"
        >
          <span className="max-w-40 truncate">{labelFor(value)}</span>
          <Combobox.ChipRemove
            aria-label={`Remove ${labelFor(value)}`}
            className="flex size-4 cursor-default items-center justify-center rounded text-muted-foreground-faded hover:bg-secondary hover:text-foreground"
          >
            <XIcon />
          </Combobox.ChipRemove>
        </Combobox.Chip>
      ))}
      {values.length > 4 && (
        <span className="px-1 text-xs text-muted-foreground-faded">
          +{values.length - 3} more
        </span>
      )}
      <Combobox.Input
        id={inputId}
        readOnly={!search}
        placeholder={values.length > 0 ? "" : placeholder}
        aria-description={
          values.length > 0
            ? `${values.length} selected. From the start of the input, press Left Arrow to focus the selected items`
            : undefined
        }
        className="h-5 min-w-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground-faded"
      />
    </Combobox.Chips>
  );
}

/**
 * The portalized option surface `FilterSelect` hands each field: the search
 * field (single mode only — multi's field input is the search), the item
 * list with a `"No options found"` empty face, and the footer actions.
 * `Select All` pairs with `Clear` as in evidence — both hang off `clear` —
 * and unions the *filtered* options into the selection rather than
 * replacing it.
 */
export function SelectPopup({
  label,
  search,
  clear,
  onSelectAll,
}: {
  label: string;
  search: boolean;
  clear: boolean;
  onSelectAll?: (values: readonly string[]) => void;
}): ReactElement {
  return (
    <Combobox.Portal>
      <Combobox.Positioner
        align="start"
        sideOffset={4}
        className="z-50 outline-none"
      >
        <Combobox.Popup
          aria-label={label}
          className="w-[var(--anchor-width)] min-w-40 overflow-hidden rounded-md border border-input bg-popover text-sm text-foreground shadow-lg"
        >
          {search && (
            <div className="flex items-center gap-1 border-b border-popover-border pr-2">
              <SearchIcon className="ml-2 shrink-0 text-muted-foreground-faded" />
              <Combobox.Input
                aria-label="Search"
                placeholder="Search"
                className="h-8 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground-faded"
              />
            </div>
          )}
          <Combobox.Empty>
            <div className="px-2 py-1.5 text-sm text-muted-foreground-faded">
              No options found
            </div>
          </Combobox.Empty>
          <Combobox.List className="max-h-[min(24.5rem,var(--available-height))] overflow-y-auto overscroll-contain py-1 data-empty:p-0">
            {(item: OptionItem) => (
              <Combobox.Item
                key={item.value}
                value={item.value}
                className="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent"
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
            <div className="border-t border-popover-border">
              {onSelectAll && <SelectAllButton onSelectAll={onSelectAll} />}
              <Combobox.Clear className="w-full cursor-default px-3 py-1.5 text-left text-sm text-label hover:bg-accent data-[visible]:not-last:border-b-0">
                Clear
              </Combobox.Clear>
            </div>
          )}
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}

/**
 * Footers' `Select All` — unions the currently filtered options into the
 * selection (evidence's `selectAll`), hidden when the filtered list is
 * empty. A plain button rather than `Combobox.Clear` so it never triggers
 * a value reset; `onMouseDown preventDefault` keeps focus on the input.
 */
function SelectAllButton({
  onSelectAll,
}: {
  onSelectAll: (values: readonly string[]) => void;
}): ReactElement | null {
  const filtered = Combobox.useFilteredItems<OptionItem>();
  if (filtered.length === 0) return null;
  return (
    <button
      type="button"
      className="w-full cursor-default px-3 py-1.5 text-left text-sm text-label hover:bg-accent"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelectAll(filtered.map((item) => item.value))}
    >
      Select All
    </button>
  );
}
