import type { ReactElement } from "react";
import { Switch } from "../../../components/switch";
import { usePageFilter } from "../../filters/use-page-filter";
import { titleCase } from "./option-items";
import type { ToggleProps } from "./types";

const rowBase =
  "mb-4 flex h-9 w-fit items-center gap-3 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

const switchClass =
  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-neutral-200 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 data-checked:bg-neutral-900 data-disabled:cursor-not-allowed data-disabled:opacity-60 dark:bg-neutral-700 dark:data-checked:bg-neutral-200";

const thumbClass =
  "absolute start-0.5 block size-4 rounded-full bg-white shadow-sm transition-transform data-checked:translate-x-4 dark:bg-neutral-900 dark:data-checked:bg-neutral-800";

/**
 * The `<Toggle>` MDX widget — a boolean switch filter input (evidence's
 * `toggle`). `?id=` IS the emitted boolean — `invert` flips the stored
 * value, so the switch's checked face is `value XOR invert` — and the
 * value never predicates (`column: false`): it is consumed through
 * `{{params.id}}` interpolation only. Writes `?id=true`/`?id=false`; the
 * param is never deleted by toggling.
 *
 * @example
 * <Toggle id="large_orders" label="Large orders" />
 * <Toggle id="show_inactive" label="Show inactive" invert />
 */
export function Toggle({
  id,
  label,
  invert = false,
  initialValue,
}: ToggleProps): ReactElement {
  const filter = usePageFilter<boolean>(id, {
    column: false,
    deserialize: (raw) => raw === "true",
    initialValue: initialValue ?? false,
  });
  const face = (filter?.value ?? false) !== invert;
  // The Switch renders a real (visually hidden) checkbox under this id, so
  // a native <label htmlFor> both names it — base-ui resolves the label to
  // aria-labelledby — and activates it: a label click toggles natively,
  // with no handler in our code to double-fire against the switch's own.
  const faceId = `${id}-face`;

  return (
    <div className={`${rowBase} ${filter ? "" : "opacity-60"}`}>
      <label
        htmlFor={faceId}
        className={`min-w-0 flex-1 truncate select-none ${filter ? "cursor-pointer" : "cursor-not-allowed"}`}
      >
        {label ?? titleCase(id)}
      </label>
      <Switch.Root
        id={faceId}
        checked={face}
        onCheckedChange={(faceChecked) => {
          if (filter) filter.value = faceChecked !== invert;
        }}
        disabled={!filter}
        className={switchClass}
      >
        <Switch.Thumb className={thumbClass} />
      </Switch.Root>
    </div>
  );
}
