import type { ReactElement } from "react";

/**
 * Author misuse of a markdown widget — a prop value outside its contract,
 * a tag mounted outside its required parent — renders inline as
 * `role=alert` so a malformed section never takes down the page around it.
 * Same red panel the data widgets use for query failures.
 *
 * @example
 * return <WidgetError name="Tab" message="must be a direct child of <Tabs>" />;
 */
export function WidgetError({
  name,
  message,
}: {
  name: string;
  message: string;
}): ReactElement {
  return (
    <p
      role="alert"
      className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      <code className="font-medium">{name}</code>: {message}
    </p>
  );
}
