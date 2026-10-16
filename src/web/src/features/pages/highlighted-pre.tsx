import {
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { highlightFence } from "./shiki-highlighter";

// A fence wider than the page scrolls inside itself, never the page
// (WCAG 1.4.10 Reflow), and a scrolling region must be reachable by
// keyboard (axe `scrollable-region-focusable`,
// https://dequeuniversity.com/rules/axe/4.10/scrollable-region-focusable),
// so it takes `tabIndex={0}` and with it the shared focus ring.
const FENCE_SCROLLER_CLASS = "overflow-x-auto";

// Shiki paints the fence background on its own `pre`; without this the
// `pre` stays as wide as the scroller and the background ends where the
// first screenful of code does once the fence is scrolled sideways.
const SHIKI_PRE_FILLS_SCROLL_CLASS = "[&>pre]:min-w-fit";

// Shiki's `pre` carries its own `tabindex="0"` and sits inside the
// scroller's overflow clip, so its focus ring is drawn inside its edge.
const SHIKI_PRE_RING_INSET_CLASS = "[&>pre]:focus-visible:-outline-offset-2";

// A fence reads as code on its own surface: `--muted` (which shiki's
// `pre` also paints through `--shiki-background`), a corner from the
// `--radius` scale and type a step below the prose.
const FENCE_SURFACE_CLASS = "rounded-md bg-muted text-sm";

// The padding sits on the `pre`, not the scroller: the `pre` grows to the
// code's width, so its right gutter scrolls into view with the last
// column instead of ending at the scroller's edge.
const FENCE_PADDING_CLASS = "px-4 py-3";
const SHIKI_PRE_PADDING_CLASS = "[&>pre]:px-4 [&>pre]:py-3";

interface Fence {
  lang: string;
  code: string;
}

/**
 * A compiled fence arrives as `<pre><code className="language-*">…` — the
 * `language-*` class on the `code` child is what marks it as a fence (an
 * inline `code` never nests under `pre`, so `pre` is the fence boundary).
 */
function fenceFromChildren(children: ReactNode): Fence | null {
  if (!isValidElement(children)) return null;
  const { className, children: code } = children.props as {
    className?: string;
    children?: unknown;
  };
  const lang = /language-(\w+)/.exec(className ?? "")?.[1];
  if (!lang || typeof code !== "string") return null;
  return { lang, code };
}

/**
 * `pre` override for the MDX component map: fences resolve through shiki
 * into a generated `<pre>` tree (shiki escapes the code text itself, so
 * the injected markup carries no author HTML). While highlighting is in
 * flight — and for non-fence or unknown-language `pre`s — the original
 * elements render unchanged. Either way the block scrolls sideways inside
 * itself and takes keyboard focus.
 */
export function HighlightedPre({
  children,
  ...preProps
}: HTMLAttributes<HTMLPreElement>) {
  const fence = useMemo(() => fenceFromChildren(children), [children]);
  const key = fence ? `${fence.lang}\n${fence.code}` : null;
  const [highlighted, setHighlighted] = useState<{
    key: string;
    html: string;
  } | null>(null);

  useEffect(() => {
    if (!fence || !key) return;
    let live = true;
    void highlightFence(fence.lang, fence.code).then((html) => {
      if (live && html) setHighlighted({ key, html });
    });
    return () => {
      live = false;
    };
  }, [fence, key]);

  if (highlighted && highlighted.key === key) {
    return (
      <div
        className={`${FENCE_SCROLLER_CLASS} ${FENCE_SURFACE_CLASS} ${SHIKI_PRE_PADDING_CLASS} ${SHIKI_PRE_FILLS_SCROLL_CLASS} ${SHIKI_PRE_RING_INSET_CLASS}`}
        tabIndex={0}
        dangerouslySetInnerHTML={{ __html: highlighted.html }}
      />
    );
  }
  return (
    <pre
      {...preProps}
      className={`${FENCE_SCROLLER_CLASS} ${FENCE_SURFACE_CLASS} ${FENCE_PADDING_CLASS}`}
      tabIndex={0}
    >
      {children}
    </pre>
  );
}
