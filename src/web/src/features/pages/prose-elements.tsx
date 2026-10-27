import { Link } from "@tanstack/react-router";
import type { AnchorHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type ProseTag =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "p"
  | "ul"
  | "ol"
  | "blockquote"
  | "th"
  | "td";

// Tailwind preflight zeroes heading sizes and paragraph margins, so markdown
// would otherwise render as one run of body text. Weight, line-height and
// balanced wrapping follow common document stylesheets; a heading that opens
// its container (a page, a callout body) sits flush. `font-heading` is the
// brand's heading font, which may differ from the body's.
const HEADING =
  "max-w-measure font-heading font-semibold leading-tight text-balance first:mt-0";

/**
 * A markdown element override for the MDX components map: renders `tag`
 * with the page type scale, and a caller's `className` wins over it. Only
 * markdown-generated elements go through the map — a widget's literal JSX
 * `<h4>`/`<p>` keeps its own styles.
 *
 * @example
 * const Lead = proseElement("p", "text-lg");
 * <Lead>Order volume.</Lead>; // <p class="text-lg">Order volume.</p>
 */
function proseElement(tag: ProseTag, scale: string) {
  function ProseElement({ className, ...rest }: HTMLAttributes<HTMLElement>) {
    const Element = tag;
    return <Element className={cn(scale, className)} {...rest} />;
  }
  ProseElement.displayName = `Prose(${tag})`;
  return ProseElement;
}

export const ProseH1 = proseElement(
  "h1",
  cn(HEADING, "mb-4 text-3xl font-bold"),
);
export const ProseH2 = proseElement("h2", cn(HEADING, "mt-10 mb-3 text-2xl"));
export const ProseH3 = proseElement("h3", cn(HEADING, "mt-8 mb-2 text-xl"));
export const ProseH4 = proseElement("h4", cn(HEADING, "mt-6 mb-2 text-lg"));
export const ProseH5 = proseElement("h5", cn(HEADING, "mt-6 mb-2 text-base"));
export const ProseH6 = proseElement("h6", cn(HEADING, "mt-6 mb-2 text-base"));
// A paragraph carries the block gap itself, not only from the page column,
// so paragraphs inside a callout, details or tab body keep the same rhythm.
// The last one drops it so such a body ends flush with the widget's padding.
export const ProseParagraph = proseElement(
  "p",
  "mb-block-gap max-w-measure last:mb-0",
);
// Lists and quotes are running text too, so they stop at the same measure.
// Preflight strips list markers and their indent, which runs a list's items
// together into one paragraph; these restore both.
export const ProseUnorderedList = proseElement(
  "ul",
  "max-w-measure list-disc pl-6",
);
export const ProseOrderedList = proseElement(
  "ol",
  "max-w-measure list-decimal pl-6",
);
export const ProseBlockquote = proseElement("blockquote", "max-w-measure");

// Preflight leaves a GFM table unpadded and unruled, so its header cells
// run together. The rules, padding and size match the `<Table>` widget so
// both read as one table style on a page. A GFM column alignment arrives
// as an inline `text-align`, which wins over the header's `text-left`.
const TABLE = "w-full border-collapse text-sm tabular-nums";

// A table wider than the page scrolls inside itself, never the page (WCAG
// 1.4.10 Reflow), and a scrolling region must be reachable by keyboard
// (axe `scrollable-region-focusable`), so its scroller takes `tabIndex={0}`
// as a code fence's does. The scroller is the page block, so it carries the
// block gap.
const TABLE_SCROLLER = "mb-block-gap overflow-x-auto last:mb-0";

/**
 * The markdown `table` override: a GFM table inside its own horizontal
 * scroller, so long cells such as code spans never widen the page.
 *
 * @example
 * <ProseTable><tbody><tr><ProseTd>Direct</ProseTd></tr></tbody></ProseTable>;
 */
export function ProseTable({
  className,
  ...rest
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className={TABLE_SCROLLER} tabIndex={0}>
      <table className={cn(TABLE, className)} {...rest} />
    </div>
  );
}
export const ProseTh = proseElement(
  "th",
  "border-b border-border-strong py-1 pr-4 text-left font-medium last:pr-0",
);
// A code span in a cell is an identifier or a flag; broken at its hyphen,
// `--cap-drop` reads as two tokens. The table scrolls inside itself, so
// keeping it whole never widens the page.
export const ProseTd = proseElement(
  "td",
  "border-b border-border py-1 pr-4 last:pr-0 [&_code]:whitespace-nowrap",
);

// Underlined as well as colored: WCAG 1.4.1 rejects color as the only cue,
// and each color clears 3:1 against the body text of its theme.
const LINK =
  "rounded-sm text-link underline underline-offset-2 hover:decoration-2";

/**
 * The markdown `a` override: an absolute-path href goes through the client
 * router so page-to-page navigation never reloads the SPA; any other href
 * stays a plain anchor. Both look the same.
 *
 * @example
 * <ProseLink href="/nested/page">region detail</ProseLink>;
 */
export function ProseLink({
  href = "",
  className,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const classes = cn(LINK, className);
  if (href.startsWith("/")) {
    return <Link {...routerTarget(href)} className={classes} {...rest} />;
  }
  return <a href={href} className={classes} {...rest} />;
}

// The router appends the page URL's trailing slash to the end of `to`, so a
// query or anchor left inside it would carry the slash; it gets them apart.
function routerTarget(href: string): {
  to: string;
  search: Record<string, string>;
  hash: string | undefined;
} {
  const url = new URL(href, "https://prose.invalid");
  return {
    to: url.pathname,
    search: Object.fromEntries(url.searchParams),
    hash: url.hash.slice(1) || undefined,
  };
}
