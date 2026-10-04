import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import {
  collectTocHeadings,
  pickActiveHeadingId,
  type TocHeading,
} from "./toc-headings";

const TOC_LABEL = "On this page";

interface HighlightBox {
  top: number;
  height: number;
}

function sameHeadings(a: TocHeading[], b: TocHeading[]): boolean {
  return (
    a.length === b.length &&
    a.every((h, i) => h.id === b[i]?.id && h.text === b[i]?.text)
  );
}

/**
 * The right-rail "On this page" table of contents. Headings are read from
 * the rendered article DOM (evidence's approach — no rehype plugin), with
 * a debounced MutationObserver re-extracting when the page mutates. The
 * scroll-spy ports framework's `client/toc.ts`: an IntersectionObserver
 * bounded at the viewport's vertical center triggers a full recompute —
 * a `location.hash` match wins near the top, otherwise the lowest heading
 * still above center — and the highlight bar slides to the active link.
 * Renders nothing when the article has fewer than two qualifying headings.
 *
 * @example
 * <main ref={setArticle}>{content}</main>
 * {article && <NavToc article={article} />}
 */
export function NavToc({ article }: { article: HTMLElement }) {
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bar, setBar] = useState<HighlightBox | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const extract = () =>
      setHeadings((prev) => {
        const next = collectTocHeadings(article);
        return sameHeadings(prev, next) ? prev : next;
      });
    extract();
    let debounce: number | undefined;
    const observer = new MutationObserver(() => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(extract, 300);
    });
    observer.observe(article, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      window.clearTimeout(debounce);
      observer.disconnect();
    };
  }, [article]);

  useEffect(() => {
    const recompute = () => {
      const id = pickActiveHeadingId(
        headings.map((h) => ({
          id: h.id,
          top: h.element.getBoundingClientRect().top,
        })),
        window.location.hash,
        window.innerHeight,
      );
      setActiveId(id);
      const item = id
        ? listRef.current
            ?.querySelector(`a[href="#${CSS.escape(id)}"]`)
            ?.closest("li")
        : null;
      setBar(item ? { top: item.offsetTop, height: item.offsetHeight } : null);
    };
    recompute();
    const observer = new IntersectionObserver(recompute, {
      rootMargin: "0px 0px -50% 0px",
    });
    for (const h of headings) observer.observe(h.element);
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <aside className="sticky top-16 hidden max-h-[calc(100vh-4rem)] w-56 shrink-0 self-start overflow-y-auto xl:block">
      <nav aria-label={TOC_LABEL}>
        <p className="pb-2 text-xs font-medium tracking-wide text-neutral-500 dark:text-neutral-400">
          {TOC_LABEL}
        </p>
        <ul
          ref={listRef}
          className="relative border-l border-neutral-200 dark:border-neutral-800"
        >
          {bar && (
            <div
              aria-hidden
              data-testid="toc-highlight"
              className="absolute -left-px w-0.5 bg-neutral-700 transition-[top,height] duration-150 dark:bg-neutral-400"
              style={{ top: bar.top, height: bar.height }}
            />
          )}
          {headings.map((heading) => (
            <li
              key={heading.id}
              className={heading.level === 3 ? "pl-4" : undefined}
            >
              <a
                href={`#${heading.id}`}
                aria-current={heading.id === activeId ? "location" : undefined}
                className={cn(
                  "block px-3 py-1 text-sm",
                  heading.id === activeId
                    ? "font-medium text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
                )}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
