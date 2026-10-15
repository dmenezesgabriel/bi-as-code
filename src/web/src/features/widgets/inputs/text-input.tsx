import { useEffect, useState, type ReactElement } from "react";
import { Input } from "../../../components/input";
import { usePageFilter } from "../../filters/use-page-filter";
import { titleCase } from "./option-items";
import type { TextInputProps } from "./types";

/** Quiet window before a typed value lands in `?id=` — evidence commits per
 * keystroke, but every URL write re-runs each `{{params.id}}` consumer. */
const COMMIT_DEBOUNCE_MS = 300;

/**
 * The `<TextInput>` MDX widget — a free-text filter input (evidence's
 * `text_input`). The value persists as `?id=<text>` and never predicates
 * (`column: false`): it is consumed through `{{params.id}}` interpolation
 * only. The field is a local draft — the filter commits after ~300ms of
 * quiet, or immediately on blur/Enter, so a URL seed or an external write
 * can't clobber mid-typing (and clearing the field deletes the param).
 *
 * @example
 * <TextInput id="q" title="Search" placeholder="Find an order" />
 */
export function TextInput({
  id,
  title,
  placeholder,
  initialValue,
}: TextInputProps): ReactElement {
  const filter = usePageFilter<string>(id, {
    column: false,
    initialValue: initialValue || undefined,
  });
  const held = filter?.value;
  const [draft, setDraft] = useState(held ?? "");
  const [lastHeld, setLastHeld] = useState(held);

  // External writes (URL seed, another writer's commit) sync into the draft
  // mid-render — adjusting during render beats an effect: no stale paint
  // between the `?id=` write and the field catching up. Our own commit
  // echoes the same string — `setDraft` is then a no-op.
  if (held !== lastHeld) {
    setLastHeld(held);
    setDraft(held ?? "");
  }

  useEffect(() => {
    if (!filter || draft === (held ?? "")) return;
    const timer = window.setTimeout(() => {
      filter.value = draft === "" ? undefined : draft;
    }, COMMIT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, held, filter]);

  function commit(text: string) {
    if (!filter) return;
    filter.value = text === "" ? undefined : text;
  }

  return (
    <div className="relative mb-4 w-64">
      <label
        htmlFor={id}
        className="mb-1 block cursor-default truncate text-sm font-medium text-label"
      >
        {title ?? titleCase(id)}
      </label>
      <Input
        id={id}
        value={draft}
        onValueChange={setDraft}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(draft);
        }}
        placeholder={placeholder ?? "Enter text..."}
        disabled={!filter}
        className="h-8 w-full rounded-md border border-input bg-field px-2 text-sm text-foreground placeholder:text-muted-foreground-faded focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}
