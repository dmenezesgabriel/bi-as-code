import { Link, useRouterState } from "@tanstack/react-router";
import type { NavTree } from "virtual:biac-pages";

interface Crumb {
  /** Stable list key: the crumb's route, or `dir:<id>` for directory text. */
  id: string;
  label: string;
  href?: string;
}

/**
 * Route-derived breadcrumb trail in the header, mirroring the sidebar's
 * nav hierarchy: the home page's nav name, then the directory's, then the
 * current page's — labels come from the NavTree verbatim so crumbs and
 * tree never diverge. Directories are not routes, so their crumb is plain
 * text; a route absent from the tree (404) has no position to display and
 * renders nothing. Markup follows the shadcn breadcrumb kit: an ordered
 * list under `nav[aria-label]` with the leaf marked `aria-current="page"`.
 *
 * @example
 * <Breadcrumbs tree={navTree} />
 */
export function Breadcrumbs({ tree }: { tree: NavTree }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = deriveCrumbs(tree, pathname);
  if (!crumbs) return null;
  return (
    <nav
      aria-label="breadcrumb"
      className="ml-3 min-w-0 flex-1 overflow-hidden border-l border-border pl-3"
    >
      <ol className="flex items-center gap-1.5 whitespace-nowrap text-sm">
        {crumbs.map((crumb, i) => (
          <li key={crumb.id} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden="true" className="text-separator">
                /
              </span>
            )}
            <CrumbLabel crumb={crumb} last={i === crumbs.length - 1} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function CrumbLabel({ crumb, last }: { crumb: Crumb; last: boolean }) {
  if (last) {
    return (
      <span aria-current="page" className="truncate text-foreground">
        {crumb.label}
      </span>
    );
  }
  if (crumb.href) {
    return (
      <Link
        to={crumb.href}
        className="truncate text-muted-foreground-faded hover:text-foreground focus-visible:-outline-offset-2"
      >
        {crumb.label}
      </Link>
    );
  }
  return (
    <span className="truncate text-muted-foreground-faded">{crumb.label}</span>
  );
}

function deriveCrumbs(tree: NavTree, pathname: string): Crumb[] | null {
  const home: Crumb = {
    id: "/",
    label: tree.rootPages.find((page) => page.href === "/")?.name ?? "Home",
    href: "/",
  };
  if (pathname === "/") return [{ id: home.id, label: home.label }];
  const root = tree.rootPages.find((page) => page.href === pathname);
  if (root) return [home, { id: pathname, label: root.name }];
  for (const dir of tree.directories) {
    const page = dir.pages.find((p) => p.href === pathname);
    if (page) {
      return [
        home,
        { id: `dir:${dir.id}`, label: dir.name },
        { id: pathname, label: page.name },
      ];
    }
  }
  return null;
}
