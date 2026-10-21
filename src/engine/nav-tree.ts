import { directoryKey } from "./directory-titles.js";
import type {
  DirectoryTitles,
  NavDirectory,
  NavPage,
  NavTree,
  PageManifestEntry,
} from "./types.js";

interface FlatNavItem {
  /** Page path under pages/ without extension, e.g. "nested/page". */
  slug: string;
  isHome: boolean;
  href: string;
  sidebarPosition?: number;
  icon?: string;
  /** Label the sidebar shows: fm title, "Home", or the deslugified file name. */
  displayName: string;
}

/**
 * Builds the two-level sidebar tree from the page manifest. The home page
 * sorts first; then pages with a `sidebar_position` ascend, ties and
 * unpositioned pages fall back to display-name order. Pages whose slug has a
 * single segment are root pages; deeper pages group under their first
 * segment as a directory, ordered by first appearance in the sorted list,
 * and named by its `directories` title when the config gives one.
 *
 * @example
 * buildNavTree(discoverPages("/site"), { "pages/nested": { title: "Planning" } });
 * // → { rootPages: [{ name: "Home", href: "/" }],
 * //     directories: [{ id: "nested", name: "Planning", pages: [...] }] }
 */
export function buildNavTree(
  entries: PageManifestEntry[],
  directories: DirectoryTitles,
): NavTree {
  const items = entries.map(toFlatItem).sort(compareFlatItems);
  const rootPages: NavPage[] = [];
  const dirOrder: string[] = [];
  const dirPages = new Map<string, NavPage[]>();

  for (const item of items) {
    const page = toNavPage(item);
    const segments = item.slug.split("/");
    if (item.isHome || segments.length === 1) {
      rootPages.push(page);
      continue;
    }
    const dir = segments[0]!;
    if (!dirPages.has(dir)) {
      dirPages.set(dir, []);
      dirOrder.push(dir);
    }
    dirPages.get(dir)!.push(page);
  }

  const navDirectories: NavDirectory[] = dirOrder.map((dir) => ({
    id: dir,
    name: directories[directoryKey(dir)]?.title ?? deslugify(dir),
    pages: dirPages.get(dir)!,
  }));

  return { rootPages, directories: navDirectories };
}

/** The page's link; `icon` is set only when the page names one, so the served JSON omits it otherwise. */
function toNavPage(item: FlatNavItem): NavPage {
  const page: NavPage = { name: item.displayName, href: item.href };
  if (item.icon !== undefined) page.icon = item.icon;
  return page;
}

function toFlatItem(entry: PageManifestEntry): FlatNavItem {
  return {
    slug: pageSlug(entry),
    isHome: entry.route === "/",
    href: entry.route,
    sidebarPosition: entry.sidebarPosition,
    icon: entry.icon,
    displayName: pageNavName(entry),
  };
}

/**
 * The label a page's sidebar link shows: its front-matter title, "Home"
 * for "/", or its deslugified file name. Site search names its results
 * the same way, so a result reads like the link it stands in for.
 *
 * @example
 * pageNavName({ route: "/nested/allocation", file: "pages/nested/allocation.md", isIndex: false });
 * // → "Allocation"
 */
export function pageNavName(entry: PageManifestEntry): string {
  if (entry.title !== undefined) return entry.title;
  if (entry.route === "/") return "Home";
  return deslugify(pageSlug(entry).split("/").pop()!);
}

function pageSlug(entry: PageManifestEntry): string {
  return entry.file.slice("pages/".length).replace(/\.(md|mdx)$/, "");
}

function compareFlatItems(a: FlatNavItem, b: FlatNavItem): number {
  if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
  return compareSidebarPosition(
    a.sidebarPosition,
    b.sidebarPosition,
    a.displayName,
    b.displayName,
  );
}

function compareSidebarPosition(
  aPos: number | null | undefined,
  bPos: number | null | undefined,
  aName: string,
  bName: string,
): number {
  if (
    aPos !== null &&
    aPos !== undefined &&
    bPos !== null &&
    bPos !== undefined
  ) {
    return aPos === bPos ? aName.localeCompare(bName) : aPos - bPos;
  }
  if (aPos !== null && aPos !== undefined) return -1;
  if (bPos !== null && bPos !== undefined) return 1;
  return aName.localeCompare(bName);
}

function deslugify(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
