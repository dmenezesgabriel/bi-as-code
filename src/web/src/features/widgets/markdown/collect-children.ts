import type { ReactElement, ReactNode } from "react";
import { Children, isValidElement } from "react";

/**
 * Reads data-carrier children (`<Tab>`, `<AccordionItem>`) out of the MDX
 * children a container widget receives: whitespace-only text nodes are
 * skipped, and anything breaking the contract — no children, a child that
 * isn't the carrier tag, a missing `title` — returns the error message the
 * caller renders as a `WidgetError`. Fragments don't traverse: MDX emits a
 * bare children array, matching what this contract checks.
 *
 * @example
 * const items = collectItemChildren<TabProps>(children, Tab, "Tab");
 * if (typeof items === "string") return <WidgetError name="Tabs" message={items} />;
 */
export function collectItemChildren<P extends { title?: string }>(
  children: ReactNode,
  itemType: unknown,
  childTag: string,
): ReactElement<P>[] | string {
  const elements = Children.toArray(children).filter(
    (child) => typeof child !== "string" || child.trim() !== "",
  );
  if (elements.length === 0) {
    return `requires at least one <${childTag}> child`;
  }
  const items: ReactElement<P>[] = [];
  for (const child of elements) {
    if (!isValidElement<P>(child) || child.type !== itemType) {
      return `only accepts <${childTag}> children`;
    }
    if (!child.props.title) {
      return `every <${childTag}> requires a "title" prop`;
    }
    items.push(child);
  }
  return items;
}
