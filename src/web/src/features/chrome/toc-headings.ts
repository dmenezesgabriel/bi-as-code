/** One entry of a page's table of contents — a heading plus its anchor. */
export interface TocHeading {
  /** Anchor id on the heading element — existing id kept, slug generated otherwise. */
  id: string;
  /** Visible heading text, used as the ToC link label. */
  text: string;
  /** Heading rank — 2 for h2, 3 for h3. */
  level: number;
  /** The DOM heading, retained for scroll-spy observation. */
  element: HTMLElement;
}

/** One heading's current viewport position, fed to `pickActiveHeadingId`. */
export interface HeadingTop {
  id: string;
  top: number;
}

/**
 * Collects the h2/h3 headings inside `root`, assigning each a stable anchor
 * id when it lacks one. Slug and dedupe rules follow evidence's
 * TableOfContents component: lowercase, non-word punctuation stripped,
 * whitespace/underscores folded to `-`, collisions suffixed `-1`, `-2`…; an
 * author-declared id always wins and still reserves itself. Headings with
 * no text are skipped.
 *
 * @example
 * collectTocHeadings(articleEl).map((h) => h.id); // ["intro", "results-1"]
 */
export function collectTocHeadings(root: HTMLElement): TocHeading[] {
  const used = new Set<string>();
  const headings: TocHeading[] = [];
  // `data-slot` headings are widget chrome (e.g. accordion item titles):
  // they keep heading semantics for assistive tech but aren't document
  // sections — the same exclusion Storybook's ToC applies via
  // `ignoreSelector` to component containers.
  const proseHeadings = "h2, h3:not([data-slot])";
  for (const element of root.querySelectorAll<HTMLElement>(proseHeadings)) {
    const text = element.textContent?.trim() ?? "";
    if (!text) continue;
    let id = element.getAttribute("id");
    if (!id) {
      const base = slugifyHeading(text);
      id = base;
      let n = 1;
      while (used.has(id)) id = `${base}-${n++}`;
      element.setAttribute("id", id);
    }
    used.add(id);
    headings.push({ id, text, level: Number(element.tagName[1]), element });
  }
  return headings;
}

function slugifyHeading(text: string): string {
  // Split-join over the `[\s_-]+` fold class is equivalent to evidence's
  // fold-then-trim-`-` pipeline and keeps sonarjs off edge-anchored
  // quantifiers (`/-+$/` scans every position on non-matching input).
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .join("-");
}

/**
 * Picks the active ToC heading, porting framework `client/toc.ts`'s relink
 * semantics: a `location.hash` match wins while its heading sits just below
 * the viewport top (0–40px); otherwise the lowest heading still above the
 * viewport's vertical center is current — so scrolling back up re-lights
 * earlier sections. `headings` are document-ordered with their current
 * `getBoundingClientRect().top`.
 *
 * @example
 * pickActiveHeadingId([{id: "a", top: -5}, {id: "b", top: 120}], "", 768);
 * // → "b"
 */
export function pickActiveHeadingId(
  headings: readonly HeadingTop[],
  hash: string,
  viewportHeight: number,
): string | null {
  if (hash) {
    const match = headings.find((h) => encodeURI(`#${h.id}`) === hash);
    if (match && match.top > 0 && match.top < 40) return match.id;
  }
  const current = [...headings]
    .reverse()
    .find((h) => h.top < viewportHeight * 0.5);
  return current?.id ?? null;
}
