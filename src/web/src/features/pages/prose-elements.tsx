import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type ProseTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p";

// Tailwind preflight zeroes heading sizes and paragraph margins, so markdown
// would otherwise render as one run of body text. Weight, line-height and
// balanced wrapping follow common document stylesheets; a heading that opens
// its container (a page, a callout body) sits flush.
const HEADING = "font-semibold leading-tight text-balance first:mt-0";

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
// The last paragraph drops its margin so a callout or details body ends
// flush with the widget's own padding.
export const ProseParagraph = proseElement("p", "mb-[1.2em] last:mb-0");
