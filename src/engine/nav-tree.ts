import type {
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
  /** Label the sidebar shows: fm title, "Home", or the deslugified file name. */
  displayName: string;
}

/**
 * Builds the two-level sidebar tree from the page manifest. The home page
 * sorts first; then pages with a `sidebar_position` ascend, ties and
 * unpositioned pages fall back to display-name order. Pages whose slug has a
 * single segment are root pages; deeper pages group under their first
 * segment as a directory, ordered by first appearance in the sorted list.
 *
 * @example
 * buildNavTree(discoverPages("/site"));
 * // → { rootPages: [{ name: "Home", href: "/" }],
 * //     directories: [{ id: "nested", name: "Nested", pages: [...] }] }
 */
export function buildNavTree(entries: PageManifestEntry[]): NavTree {
  const items = entries.map(toFlatItem).sort(compareFlatItems);
  const rootPages: NavPage[] = [];
  const dirOrder: string[] = [];
  const dirPages = new Map<string, NavPage[]>();

  for (const item of items) {
    const page: NavPage = { name: item.displayName, href: item.href };
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

  const directories: NavDirectory[] = dirOrder.map((dir) => ({
    id: dir,
    name: deslugify(dir),
    pages: dirPages.get(dir)!,
  }));

  return { rootPages, directories };
}

function toFlatItem(entry: PageManifestEntry): FlatNavItem {
  const slug = entry.file.slice("pages/".length).replace(/\.(md|mdx)$/, "");
  const name = slug.split("/").pop()!;
  const isHome = entry.route === "/";
  return {
    slug,
    isHome,
    href: entry.route,
    sidebarPosition: entry.sidebarPosition,
    displayName: entry.title ?? (isHome ? "Home" : deslugify(name)),
  };
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
