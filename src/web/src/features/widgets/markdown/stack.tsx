import type { ReactElement } from "react";
import { cn } from "../../../lib/cn";
import { WidgetError } from "./states";
import type { StackAlign, StackProps } from "./types";

// Evidence's `align` → `align-items` map (tags/stack/Stack.svelte). Its
// `*:w-auto` ports verbatim: children carrying `w-full` (our charts) must
// shrink-wrap or a non-stretch `align` would be a no-op.
const STACK_ALIGN: Record<StackAlign, string> = {
  left: "items-start",
  center: "items-center",
  right: "items-end",
  stretch: "items-stretch",
};

/**
 * The `<Stack>` MDX widget — children lay out vertically with a regular
 * gap. `align` sets the horizontal alignment (default `stretch`);
 * non-stretch values shrink-wrap children to their content width. A value
 * outside the four names renders an inline alert.
 *
 * @example
 * <Stack><Value data="kpi" column="revenue" /><Note>trailing four weeks</Note></Stack>
 */
export function Stack({
  align = "stretch",
  children,
}: StackProps): ReactElement {
  const alignClass = STACK_ALIGN[align];
  if (alignClass === undefined) {
    return (
      <WidgetError
        name="Stack"
        message={`align="${String(align)}" is not one of ${Object.keys(STACK_ALIGN).join(", ")}`}
      />
    );
  }
  return (
    <div className={cn("flex flex-col gap-4 [&>*]:w-auto", alignClass)}>
      {children}
    </div>
  );
}
