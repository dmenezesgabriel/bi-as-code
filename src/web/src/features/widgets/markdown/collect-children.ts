import type { ReactElement, ReactNode } from "react";
import { Children, isValidElement } from "react";

/**
 * Reads data-carrier children (`<Tab>`, `<AccordionItem>`, `<Column>`) out
 * of the MDX children a container widget receives: whitespace-only text
 * nodes are skipped, and anything breaking the contract — a child that
 * isn't the carrier tag, a carrier missing its `requiredProp` — returns
 * the error message the caller renders inline. No children yields `[]`;
 * containers that need at least one call `requireItemChildren`. Fragments
 * don't traverse: MDX emits a bare children array, matching what this
 * contract checks.
 *
 * @example
 * const columns = collectItemChildren<ColumnProps>(children, Column, "Column", "id");
 * if (typeof columns === "string") return <TableError name={data} message={columns} />;
 */
export function collectItemChildren<P extends object>(
  children: ReactNode,
  itemType: unknown,
  childTag: string,
  requiredProp: Extract<keyof P, string>,
): ReactElement<P>[] | string {
  const items: ReactElement<P>[] = [];
  for (const child of nonBlankChildren(children)) {
    if (!isValidElement<P>(child) || child.type !== itemType) {
      return `only accepts <${childTag}> children`;
    }
    if (!child.props[requiredProp]) {
      return `every <${childTag}> requires a "${requiredProp}" prop`;
    }
    items.push(child);
  }
  return items;
}

/**
 * `collectItemChildren` for containers that are meaningless empty
 * (`<Tabs>`, `<Accordion>`): zero carriers is an error message too.
 *
 * @example
 * const items = requireItemChildren<TabProps>(children, Tab, "Tab", "title");
 * if (typeof items === "string") return <WidgetError name="Tabs" message={items} />;
 */
export function requireItemChildren<P extends object>(
  children: ReactNode,
  itemType: unknown,
  childTag: string,
  requiredProp: Extract<keyof P, string>,
): ReactElement<P>[] | string {
  const items = collectItemChildren<P>(
    children,
    itemType,
    childTag,
    requiredProp,
  );
  if (typeof items === "string") return items;
  if (items.length === 0) return `requires at least one <${childTag}> child`;
  return items;
}

function nonBlankChildren(
  children: ReactNode,
): ReturnType<typeof Children.toArray> {
  return Children.toArray(children).filter(
    (child) => typeof child !== "string" || child.trim() !== "",
  );
}
