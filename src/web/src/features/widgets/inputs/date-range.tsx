import { useState, type ReactElement } from "react";
import { CalendarIcon } from "../../../components/icons";
import { Input } from "../../../components/input";
import { Popover } from "../../../components/popover";
import type { Filter } from "../../filters/filter";
import { usePageFilter } from "../../filters/use-page-filter";
import { WidgetError } from "../markdown/states";
import { titleCase } from "./option-items";
import {
  DATE_RANGE_PRESETS,
  dateRangeClause,
  isRecognizedDateRange,
  resolveDateRange,
} from "./resolve-date-range";
import type { DateRangeProps } from "./types";

const triggerClass =
  "flex h-8 w-full cursor-default items-center gap-2 rounded-md border border-input bg-field px-2 text-sm text-foreground select-none hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60";

const fieldClass =
  "h-7 w-full rounded-md border border-input bg-field px-1.5 text-sm text-foreground";

/** Evidence's `getDisplayText`: a held preset shows its label, a held
 * expression renders verbatim, and nothing held reads "All Time". */
function displayText(value: string | undefined): string {
  if (!value) return "All Time";
  const preset = DATE_RANGE_PRESETS.find(
    (p) => p.key === value.trim().toLowerCase(),
  );
  return preset?.label ?? value;
}

/** The `type="date"` pair → expression: both bound `'X to Y'`, one bound
 * `'from X'`/`'until Y'`, neither clears the filter (param deleted). */
function fieldExpression(start: string, end: string): string | undefined {
  if (start && end) return `${start} to ${end}`;
  if (start) return `from ${start}`;
  if (end) return `until ${end}`;
  return undefined;
}

/**
 * The popup's two `type="date"` fields — they show the held expression's
 * resolved window (a preset fills them with its bounds) and commit a
 * field-shaped expression on every change, keeping the popover open so the
 * second end stays editable.
 */
function RangeFields({
  filter,
  bounds,
}: {
  readonly filter: Filter<string | undefined> | undefined;
  readonly bounds: { readonly start?: string; readonly end?: string };
}): ReactElement {
  return (
    <div className="flex items-center gap-2 border-t border-popover-border px-3 py-2">
      <Input
        type="date"
        aria-label="Start date"
        value={bounds.start ?? ""}
        onValueChange={(start) => {
          if (filter) filter.value = fieldExpression(start, bounds.end ?? "");
        }}
        className={fieldClass}
      />
      <span className="text-xs text-muted-foreground-faded">to</span>
      <Input
        type="date"
        aria-label="End date"
        value={bounds.end ?? ""}
        onValueChange={(end) => {
          if (filter) filter.value = fieldExpression(bounds.start ?? "", end);
        }}
        className={fieldClass}
      />
    </div>
  );
}

/**
 * The `<DateRange>` MDX widget — a date-range filter input (evidence's
 * `range_calendar`, fields+presets instead of a calendar grid). The held
 * value is the range expression itself, written verbatim to `?id=` — a
 * preset key (`'last 30 days'`), a closed `'YYYY-MM-DD to YYYY-MM-DD'`, or
 * an open `'from X'`/`'until Y'` — so relative windows re-roll on reload.
 * `valueColumn` gates the `BETWEEN ? AND ?`/`>=`/`<=` predicate (ISO bounds
 * bound as `?` params, never interpolated — ADR-0005); without it the value
 * never predicates (`column: false`) and is a `{{params.id}}` read only.
 *
 * @example
 * <DateRange id="ordered" valueColumn="order_date" title="Ordered" />
 * <DateRange id="window" initialValue="last 30 days" />
 */
export function DateRange({
  id,
  title,
  valueColumn,
  initialValue,
}: DateRangeProps): ReactElement {
  const [open, setOpen] = useState(false);
  const badInitial =
    initialValue !== undefined && !isRecognizedDateRange(initialValue);
  const filter = usePageFilter<string | undefined>(id, {
    column: valueColumn ?? false,
    clause: dateRangeClause,
    deserialize: (raw) => raw.trim() || undefined,
    initialValue: badInitial ? undefined : initialValue,
  });

  if (badInitial) {
    return (
      <WidgetError
        name={id}
        message={`initialValue "${initialValue}" is not a recognized date range`}
      />
    );
  }

  const held = filter?.value;
  const bounds = resolveDateRange(held) ?? {};

  return (
    <div className="relative mb-4 w-64">
      <label
        htmlFor={id}
        className="mb-1 block cursor-default truncate text-sm font-medium text-label"
      >
        {title ?? titleCase(id)}
      </label>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger id={id} disabled={!filter} className={triggerClass}>
          <CalendarIcon className="shrink-0 text-muted-foreground-faded" />
          <span className="truncate">{displayText(held)}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            align="start"
            sideOffset={4}
            className="z-50 outline-none"
          >
            <Popover.Popup
              aria-label={`${title ?? titleCase(id)} range`}
              className="w-56 overflow-hidden rounded-md border border-input bg-popover text-sm text-foreground shadow-lg"
            >
              <div className="flex flex-col py-1">
                {DATE_RANGE_PRESETS.map((preset) => {
                  const active =
                    held !== undefined &&
                    preset.key === held.trim().toLowerCase();
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      aria-pressed={active}
                      className="cursor-default px-3 py-1.5 text-left text-sm text-label outline-none hover:bg-accent focus-visible:bg-accent aria-pressed:bg-accent aria-pressed:font-medium"
                      onClick={() => {
                        if (filter) filter.value = preset.key;
                        setOpen(false);
                      }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <RangeFields filter={filter} bounds={bounds} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
