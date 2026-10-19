import { PAGE_ICONS } from "./page-icon-catalog";

/**
 * A page's front-matter icon: a decorative 16 px glyph that takes the
 * surrounding text colour. A name outside the catalog renders nothing —
 * the engine already reported it where the page is compiled.
 *
 * @example
 * <PageIcon name="calendar" />
 */
export function PageIcon({ name }: { name: string }) {
  const Glyph = PAGE_ICONS[name];
  if (!Glyph) return null;
  return <Glyph aria-hidden size={16} className="shrink-0" />;
}
