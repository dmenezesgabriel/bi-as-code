import type { ReactElement } from "react";
import { cn } from "../../../lib/cn";
import { WidgetError } from "./states";
import type { CalloutProps, CalloutType } from "./types";

// Type-tint pairs, light surface + dark alpha wash. Emerald stands in for
// evidence's `fern` scale — its nearest shipped palette.
const CALLOUT_CLASSES: Record<CalloutType, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-200",
  success:
    "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-200",
  warning:
    "bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-500/10 dark:border-yellow-500/20 dark:text-yellow-200",
  error:
    "bg-red-50 border-red-200 text-red-900 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-200",
};

/**
 * The `<Callout>` MDX widget — a tinted bordered panel highlighting a
 * section of prose. `type` selects the palette (default `info`); `title`
 * renders a bold heading line above the children. A `type` outside the
 * four names renders an inline alert — MDX props bypass the type system,
 * so the schema's match check runs at render time.
 *
 * @example
 * <Callout type="warning" title="Concentration risk">…</Callout>
 */
export function Callout({
  type = "info",
  title,
  children,
}: CalloutProps): ReactElement {
  const variant = CALLOUT_CLASSES[type];
  if (variant === undefined) {
    return (
      <WidgetError
        name="Callout"
        message={`type="${String(type)}" is not one of ${Object.keys(CALLOUT_CLASSES).join(", ")}`}
      />
    );
  }
  return (
    <div
      role="note"
      className={cn(
        "flex h-fit max-h-full flex-col rounded-sm border px-3 py-2.5",
        variant,
      )}
    >
      {title !== undefined && title !== "" && (
        <h4 className="mt-0 mb-2 shrink-0 font-bold text-current">{title}</h4>
      )}
      <div className="flex-1 overflow-y-auto text-sm [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}
