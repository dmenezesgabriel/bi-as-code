import type { ReactElement } from "react";
import type { NoteProps } from "./types";

/**
 * The `<Note>` MDX widget — a muted `text-xs` block for footnotes and
 * source lines under a figure.
 *
 * @example
 * <Note>Report data sourced from the warehouse</Note>
 */
export function Note({ children }: NoteProps): ReactElement {
  return (
    <div className="mt-0 block pb-3 text-xs leading-normal text-muted-foreground-faded">
      {children}
    </div>
  );
}
