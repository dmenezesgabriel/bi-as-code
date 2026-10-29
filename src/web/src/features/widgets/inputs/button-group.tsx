import type { ReactElement } from "react";
import { Toggle, ToggleGroup } from "../../../components/toggle-group";
import { LoaderCircleIcon } from "../../../components/icons";
import { cn } from "../../../lib/cn";
import { FIELD_CONTROL_HEIGHT, FIELD_LABEL_ROW } from "./field-line";
import { titleCase } from "./option-items";
import type { ButtonGroupProps } from "./types";
import { toSelectionArray, useSelectInput } from "./use-select-input";

const toggleClass =
  "inline-flex shrink-0 cursor-default items-center border-r border-input px-3 text-sm text-foreground select-none last:border-r-0 hover:bg-accent focus-visible:z-10 disabled:cursor-not-allowed disabled:opacity-60 data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:hover:bg-primary/90";

/**
 * The `<ButtonGroup>` MDX widget — a segmented control filter input: one
 * toggle button per option (evidence's `button_group` over base-ui's
 * `ToggleGroup`/`Toggle`). `data`+`valueColumn` derive the option list from
 * a ```sql fence, `options` supplies static entries when `data` is absent,
 * `filters` cascades other page filters into the option source, `multiple`
 * switches the held value to a list, and `selectFirst` seeds the first
 * option as a programmatic default. The selection writes `?id=value`
 * (single) or `?id=["a","b"]` (multiple) to the URL — reloading restores
 * it; a pressed button pressing again deselects and deletes the param.
 * With `valueColumn` the filter predicates `=`/`IN` like the select inputs;
 * without `data` it predicates on the `id`-named column.
 *
 * @example
 * <ButtonGroup id="channel" data="channel_mix" valueColumn="channel" title="Channel" />
 * <ButtonGroup id="grain" options={["day", "week", "month"]} selectFirst />
 */
export function ButtonGroup({
  title,
  multiple = false,
  ...props
}: ButtonGroupProps): ReactElement {
  const { filter, items, loading, failure } = useSelectInput({
    ...props,
    multiple,
  });
  if (failure) return failure;

  const label = title ?? titleCase(props.id);
  const labelId = `${props.id}-label`;
  return (
    <div className="relative max-w-full">
      <span id={labelId} className={FIELD_LABEL_ROW}>
        {label}
      </span>
      <div className="overflow-x-auto pb-1">
        <ToggleGroup
          value={toSelectionArray(filter?.value)}
          onValueChange={(next: string[]) => {
            if (!filter) return;
            filter.value = multiple ? next : (next[0] ?? "");
          }}
          multiple={multiple}
          disabled={loading || !filter || items.length === 0}
          aria-labelledby={labelId}
          className={cn(
            FIELD_CONTROL_HEIGHT,
            "inline-flex w-max items-stretch overflow-hidden rounded-md border border-input bg-field data-disabled:opacity-80",
          )}
        >
          {items.length === 0 ? (
            <Toggle value="__empty" disabled className={toggleClass}>
              {loading ? (
                <LoaderCircleIcon className="text-muted-foreground-faded" />
              ) : (
                <span className="text-muted-foreground-faded">
                  No options available
                </span>
              )}
            </Toggle>
          ) : (
            items.map((item) => (
              <Toggle
                key={item.value}
                value={item.value}
                className={toggleClass}
              >
                {item.label ?? item.value}
              </Toggle>
            ))
          )}
        </ToggleGroup>
      </div>
    </div>
  );
}
