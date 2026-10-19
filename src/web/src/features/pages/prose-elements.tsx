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
  | "table"
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
export const ProseUnorderedList = proseElement("ul", "max-w-measure");
export const ProseOrderedList = proseElement("ol", "max-w-measure");
export const ProseBlockquote = proseElement("blockquote", "max-w-measure");

// Preflight leaves a GFM table unpadded and unruled, so its header cells
// run together. The rules, padding and size match the `<Table>` widget so
// both read as one table style on a page. A GFM column alignment arrives
// as an inline `text-align`, which wins over the header's `text-left`.
export const ProseTable = proseElement(
  "table",
  "mb-block-gap w-full border-collapse text-sm tabular-nums last:mb-0",
);
export const ProseTh = proseElement(
  "th",
  "border-b border-border-strong py-1 pr-4 text-left font-medium last:pr-0",
);
export const ProseTd = proseElement(
  "td",
  "border-b border-border py-1 pr-4 last:pr-0",
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
    return <Link to={href} className={classes} {...rest} />;
  }
  return <a href={href} className={classes} {...rest} />;
}
