import type { ComponentType, ReactElement, ReactNode } from "react";

/**
 * Builds the plain element arrays MDX emits as `children` for data-carrier
 * widgets (`<Tab>`, `<AccordionItem>`) — one element per
 * `[title, content, extraProps]` spec so tests and stories exercise the
 * same child-inspection contract the pipeline produces (a bare array, no
 * fragment traversal).
 *
 * @example
 * carrierChildrenEls(Tab, [["Chart", "chart body"], ["Table", "t", { default: true }]]);
 */
export function carrierChildrenEls<
  P extends { title: string; children?: ReactNode },
>(
  Carrier: ComponentType<P>,
  specs: ReadonlyArray<readonly [string, ReactNode, Partial<P>?]>,
): ReactElement[] {
  return specs.map(([title, content, extra]) => (
    <Carrier
      key={title}
      // The spec tuple builds the carrier's props wholesale; Partial<P>
      // extras can't narrow to P statically — fine, these calls stand in
      // for the untyped MDX emission anyway.
      {...({ title, children: content, ...extra } as P)}
    />
  ));
}
