import { invalidSetting } from "./invalid-setting.js";
import type { PageChrome, PageFrontmatter } from "./types.js";

const CHROME_SWITCHES: readonly (keyof PageChrome)[] = ["sidebar", "header"];

/**
 * Checks a page's chrome front-matter: `sidebar` and `header` are strict
 * booleans, like `table_of_contents`. A wrong shape fails naming the file —
 * a silently ignored `header: no thanks` would leave an embed showing the
 * site's chrome inside someone else's page.
 *
 * @example
 * assertPageChrome({ header: "no" }, "front-matter in pages/a.md");
 * // throws: Invalid front-matter in pages/a.md — header: expected a boolean, got "no"
 */
export function assertPageChrome(
  frontmatter: PageFrontmatter,
  location: string,
): void {
  for (const key of CHROME_SWITCHES) {
    const value = frontmatter[key];
    if (value === undefined || typeof value === "boolean") continue;
    throw invalidSetting(location, key, "a boolean", value);
  }
}

/**
 * The chrome switches the page manifest carries, tolerant of bad values the
 * way the nav reads `icon`: a non-boolean is dropped, and `assertPageChrome`
 * reports it when the page compiles. An absent switch stays absent, so the
 * project's `nav.sidebar` still decides it.
 *
 * @example
 * pageChrome({ sidebar: false, title: "KPIs" }); // → { sidebar: false }
 */
export function pageChrome(frontmatter: PageFrontmatter): PageChrome {
  const chrome: PageChrome = {};
  for (const key of CHROME_SWITCHES) {
    const value = frontmatter[key];
    if (typeof value === "boolean") chrome[key] = value;
  }
  return chrome;
}
