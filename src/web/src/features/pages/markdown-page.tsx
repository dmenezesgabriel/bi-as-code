import { Link, useSearch } from "@tanstack/react-router";
import { useState, type AnchorHTMLAttributes } from "react";
import { NavToc } from "../chrome/nav-toc";
import { Table } from "../widgets/table/table";
import { QueryRegistryProvider } from "./query-registry";
import { SqlBlockPre } from "./sql-block";
import type { CompiledPageModule, MdxComponentMap } from "./types";
import { useDocumentTitle } from "./use-document-title";

/**
 * MDX element overrides. `a` routes absolute-path links through the client
 * router so page-to-page navigation never reloads the SPA; `pre` hands
 * fenced code blocks to shiki and pairs named sql fences with their query
 * results; `Table` resolves `data` against that same registry. Kept
 * unexported so the map doesn't trip the Fast Refresh rule that files
 * exporting components export only components.
 */
const mdxComponents: MdxComponentMap = {
  a: MarkdownLink,
  pre: SqlBlockPre,
  Table,
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
 * Unless front-matter `table_of_contents: false`, a right-rail ToC built
 * from the article's h2/h3 headings rides along on `xl` viewports.
 *
 * @example
 * const mod = await entry.load();
 * return <MarkdownPage page={mod} siteTitle={config.title} />;
 */
export function MarkdownPage({
  page,
  siteTitle,
}: {
  page: CompiledPageModule;
  siteTitle: string;
}) {
  useDocumentTitle(page.title, siteTitle);
  const [article, setArticle] = useState<HTMLElement | null>(null);
  const params = useSearch({ strict: false });
  const Content = page.default;
  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-6 py-10">
      <main
        ref={setArticle}
        className="mx-auto w-full min-w-0 max-w-4xl [&_h2]:scroll-mt-20 [&_h3]:scroll-mt-20"
      >
        {/* A page with no named ```sql blocks mounts no registry, so it never
            downloads the wasm bundle. */}
        {page.sqlBlocks.length > 0 ? (
          <QueryRegistryProvider
            sqlBlocks={page.sqlBlocks}
            sqlTables={page.sqlTables}
            params={params}
          >
            <Content components={mdxComponents} />
          </QueryRegistryProvider>
        ) : (
          <Content components={mdxComponents} />
        )}
      </main>
      {page.frontmatter.table_of_contents !== false && article && (
        <NavToc article={article} />
      )}
    </div>
  );
}
