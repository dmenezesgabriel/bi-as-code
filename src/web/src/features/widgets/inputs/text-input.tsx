import type { ReactElement } from "react";
import { usePageFilter } from "../../filters/use-page-filter";
import { DraftTextField } from "./draft-text-field";
import { titleCase } from "./option-items";
import type { TextInputProps } from "./types";

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
  return (
    <DraftTextField
      id={id}
      label={title ?? titleCase(id)}
      placeholder={placeholder ?? "Enter text..."}
      type="text"
      filter={filter}
    />
  );
}
