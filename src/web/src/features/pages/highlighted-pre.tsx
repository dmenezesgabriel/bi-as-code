import {
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { highlightFence } from "./shiki-highlighter";

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
 * elements render unchanged.
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
    return <div dangerouslySetInnerHTML={{ __html: highlighted.html }} />;
  }
  return <pre {...preProps}>{children}</pre>;
}
