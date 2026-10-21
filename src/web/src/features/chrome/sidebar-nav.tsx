import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type MouseEvent } from "react";
import type { NavDirectory, NavPage, NavTree } from "virtual:biac-pages";
import { PageIcon } from "../../components/page-icon";
import { cn } from "../../lib/cn";
import { SiteSearch } from "../search/site-search";
import type { LoadPageSearchDocuments } from "../search/types";
import { readDirOpenMap, writeDirOpen } from "./sidebar-storage";

/**
 * The sidebar's page tree: site title up top, the search box under it when
 * `loadSearchDocuments` is given, then root-level page links,
 * then one collapsible `<details>` group per first path segment. While a
 * search shows results, they take the page links' place; `onRevealSearch`
 * makes the sidebar visible when a shortcut focuses the box. A group
 * opens by default when it contains the active page; once the user toggles
 * it, the explicit choice is persisted and wins on every later visit.
 *
 * @example
 * <SidebarNav tree={navTree} siteTitle={config.title} onNavigate={closeDrawer} onRevealSearch={openDrawer} />
 */
export function SidebarNav({
  tree,
  siteTitle,
  loadSearchDocuments,
  onNavigate,
  onRevealSearch,
}: {
  tree: NavTree;
  siteTitle: string;
  loadSearchDocuments?: LoadPageSearchDocuments;
  onNavigate: () => void;
  onRevealSearch: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dirOpen, setDirOpen] =
    useState<Record<string, boolean>>(readDirOpenMap);
  const [searching, setSearching] = useState(false);

  function isDirOpen(dir: NavDirectory): boolean {
    return dirOpen[dir.id] ?? dir.pages.some((page) => page.href === pathname);
  }

  function toggleDir(dir: NavDirectory) {
    const open = !isDirOpen(dir);
    setDirOpen((map) => ({ ...map, [dir.id]: open }));
    writeDirOpen(dir.id, open);
  }

  return (
    <nav
      aria-label="Site navigation"
      className="flex h-full flex-col overflow-y-auto"
    >
      <Link
        to="/"
        onClick={onNavigate}
        className="block px-4 py-3 font-heading text-base font-bold text-foreground focus-visible:-outline-offset-2"
      >
        {siteTitle}
      </Link>
      {loadSearchDocuments && (
        <SiteSearch
          loadDocuments={loadSearchDocuments}
          onNavigate={onNavigate}
          onReveal={onRevealSearch}
          onSearchingChange={setSearching}
        />
      )}
      <ul hidden={searching} className="flex-1 px-2 pb-4">
        {tree.rootPages.map((page) => (
          <li key={page.href}>
            <NavLink page={page} pathname={pathname} onNavigate={onNavigate} />
          </li>
        ))}
        {tree.directories.map((dir) => (
          <li key={dir.id}>
            <details open={isDirOpen(dir)} className="group/details">
              <summary
                onClick={(event: MouseEvent) => {
                  event.preventDefault();
                  toggleDir(dir);
                }}
                className="cursor-pointer select-none rounded-sm px-2 py-1.5 text-sm font-medium text-sidebar-foreground hover:bg-accent"
              >
                {dir.name}
              </summary>
              <ul className="my-1 ml-2 border-l border-border pl-2">
                {dir.pages.map((page) => (
                  <li key={page.href}>
                    <NavLink
                      page={page}
                      pathname={pathname}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavLink({
  page,
  pathname,
  onNavigate,
}: {
  page: NavPage;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = page.href === pathname;
  return (
    <Link
      to={page.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm focus-visible:-outline-offset-2",
        active
          ? "bg-sidebar-accent/60 font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {page.icon && <PageIcon name={page.icon} />}
      {page.name}
    </Link>
  );
}
