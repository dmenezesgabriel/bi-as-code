import { useEffect, useState } from "react";
import type { Filter } from "../../filters/filter";

/** Quiet window before a typed value lands in `?id=` — evidence commits per
 * keystroke, but every URL write re-runs each consumer of the filter. */
const COMMIT_DEBOUNCE_MS = 300;

/** The free-text field's local draft and the ways it reaches the filter. */
export interface TextDraft {
  readonly draft: string;
  readonly setDraft: (text: string) => void;
  /** Commits `text` now — blur and Enter skip the debounce. */
  readonly commit: (text: string) => void;
}

/**
 * The draft a free-text filter field edits: typing stays local and commits
 * to the filter after ~300ms of quiet, or at once through `commit`, so a
 * URL seed or an external write can't clobber mid-typing. An empty draft
 * commits `undefined`, which deletes the param.
 *
 * @example
 * const { draft, setDraft, commit } = useTextDraft(filter);
 * <Input value={draft} onValueChange={setDraft} onBlur={() => commit(draft)} />
 */
export function useTextDraft(filter: Filter<string> | undefined): TextDraft {
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

  return { draft, setDraft, commit };
}
