import type { ReactElement } from "react";
import { Input } from "../../../components/input";
import { cn } from "../../../lib/cn";
import type { Filter } from "../../filters/filter";
import { FIELD_CONTROL_HEIGHT, FIELD_LABEL_ROW } from "./field-line";
import { useTextDraft } from "./use-text-draft";

interface DraftTextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly placeholder: string;
  /** `search` gives the field the `searchbox` role and a native clear button. */
  readonly type: "text" | "search";
  /** `undefined` outside a `FiltersProvider` — the field renders disabled. */
  readonly filter: Filter<string> | undefined;
}

/**
 * The labelled free-text field the text filter inputs share: edits a local
 * draft (`useTextDraft`) and commits it on quiet, blur or Enter.
 *
 * @example
 * <DraftTextField id="q" label="Search" placeholder="Search" type="search" filter={filter} />
 */
export function DraftTextField({
  id,
  label,
  placeholder,
  type,
  filter,
}: DraftTextFieldProps): ReactElement {
  const { draft, setDraft, commit } = useTextDraft(filter);
  return (
    <div className="relative w-64">
      <label htmlFor={id} className={FIELD_LABEL_ROW}>
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={draft}
        onValueChange={setDraft}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(draft);
        }}
        placeholder={placeholder}
        disabled={!filter}
        className={cn(
          FIELD_CONTROL_HEIGHT,
          "w-full rounded-md border border-input bg-field px-2 text-sm text-foreground placeholder:text-muted-foreground-faded disabled:cursor-not-allowed disabled:opacity-60",
        )}
      />
    </div>
  );
}
