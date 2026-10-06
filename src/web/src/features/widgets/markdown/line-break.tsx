import type { ReactElement } from "react";
import type { LineBreakProps } from "./types";

/**
 * The `<LineBreak>` MDX widget — `lines` `<br/>`s of vertical spacing
 * between sections (default 1); a non-positive count renders nothing.
 *
 * @example
 * <LineBreak lines={2} />
 */
export function LineBreak({ lines = 1 }: LineBreakProps): ReactElement {
  return (
    <>
      {Array.from({ length: Math.max(0, lines) }, (_, i) => (
        <br key={i} />
      ))}
    </>
  );
}
