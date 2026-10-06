import type { ReactElement } from "react";
import { cn } from "../../../lib/cn";
import { WidgetError } from "./states";
import type { RowAlign, RowProps } from "./types";

// Evidence's `align` → `align-items` map (tags/row/Row.svelte); its
// ResizeObserver grow-fix exists only for a per-child `width` prop we
// don't ship, so equal `flex-1` shares need no fix-up. `h-auto` mirrors
// its `*:h-auto` — keeps a child carrying `h-full` from pinning the line.
const ROW_ALIGN: Record<RowAlign, string> = {
  top: "items-start",
  center: "items-center",
  bottom: "items-end",
  stretch: "items-stretch",
};

/**
 * The `<Row>` MDX widget — children share each line equally (`flex-1` on a
 * `basis-72`, so lines wrap under ~288px per child) and `min-w-0` lets
 * them shrink past their content width instead of overflowing. `align`
 * sets the vertical alignment inside the line (default `stretch`); a
 * value outside the four names renders an inline alert.
 *
 * @example
 * <Row><BigValue data="kpi" column="revenue" /><BigValue data="kpi" column="orders" /></Row>
 */
export function Row({ align = "stretch", children }: RowProps): ReactElement {
  const alignClass = ROW_ALIGN[align];
  if (alignClass === undefined) {
    return (
      <WidgetError
        name="Row"
        message={`align="${String(align)}" is not one of ${Object.keys(ROW_ALIGN).join(", ")}`}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex flex-wrap gap-4 [&>*]:h-auto [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-72",
        alignClass,
      )}
    >
      {children}
    </div>
  );
}
