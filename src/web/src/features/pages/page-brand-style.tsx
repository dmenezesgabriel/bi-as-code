import { useLayoutEffect, useState, type ReactNode } from "react";

type PageBrandStyleProps = {
  /** The page's front-matter `brand:` stylesheet; empty when it sets none. */
  css: string;
  children: ReactNode;
};

/**
 * Applies a page's own brand stylesheet to the whole document while the
 * page is mounted. Rendered after the project's brand `<style>` (the first
 * element of `<body>`), it wins by cascade, and leaves with the page.
 *
 * The page renders only once the stylesheet is committed: the chart theme
 * reads tokens with `getComputedStyle` while rendering (ADR-0014), so a
 * chart rendered in the same pass would draw the previous page's colours.
 * The layout effect's re-render runs before the browser paints, so no
 * frame shows the page without its content.
 *
 * @example
 * <PageBrandStyle css={mod.brandCss}>
 *   <MarkdownPage page={mod} />
 * </PageBrandStyle>
 */
export function PageBrandStyle({ css, children }: PageBrandStyleProps) {
  const [committed, setCommitted] = useState(false);
  useLayoutEffect(() => setCommitted(true), []);
  return (
    <>
      {css !== "" && <style>{css}</style>}
      {committed && children}
    </>
  );
}
