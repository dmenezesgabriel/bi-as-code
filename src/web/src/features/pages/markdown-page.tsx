import { Link } from "@tanstack/react-router";
import type { AnchorHTMLAttributes } from "react";
import { HighlightedPre } from "./highlighted-pre";
import type { CompiledPageModule, MdxComponentMap } from "./types";
import { useDocumentTitle } from "./use-document-title";

/**
 * MDX element overrides. `a` routes absolute-path links through the client
 * router so page-to-page navigation never reloads the SPA; `pre` hands
 * fenced code blocks to shiki. Kept unexported so the map doesn't trip the
 * Fast Refresh rule that files exporting components export only
 * components.
 */
const mdxComponents: MdxComponentMap = {
  a: MarkdownLink,
  pre: HighlightedPre,
};

function MarkdownLink({
  href = "",
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href.startsWith("/")) {
    return <Link to={href} {...rest} />;
  }
  return <a href={href} {...rest} />;
}

/**
 * Renders one compiled page module: the resolved title is applied to the
 * document and the MDX component renders with the shared component map.
 *
 * @example
 * const mod = await entry.load();
 * return <MarkdownPage page={mod} />;
 */
export function MarkdownPage({ page }: { page: CompiledPageModule }) {
  useDocumentTitle(page.title);
  const Content = page.default;
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Content components={mdxComponents} />
    </main>
  );
}
