import { didYouMean } from "./closest-key.js";
import { invalidSetting } from "./invalid-setting.js";

// A curated set of Lucide names (https://lucide.dev/icons), canonical as of
// lucide-react 1.49.0: a fixed set keeps the sidebar's icons in the bundle,
// painted with the page, rather than ~2000 lazy chunks popping in after.
// The SPA's wrap site (src/web/src/components/page-icon.tsx) restates it as
// a name → glyph map; an integration test pins the two equal.
export const PAGE_ICON_NAMES: readonly string[] = [
  "house",
  "layout-dashboard",
  "layers",
  "chart-column",
  "chart-bar",
  "chart-line",
  "chart-area",
  "chart-pie",
  "gauge",
  "trending-up",
  "trending-down",
  "activity",
  "table",
  "sheet",
  "database",
  "server",
  "cloud",
  "calendar",
  "clock",
  "users",
  "user",
  "building",
  "briefcase",
  "store",
  "factory",
  "warehouse",
  "truck",
  "package",
  "shopping-cart",
  "receipt",
  "credit-card",
  "wallet",
  "dollar-sign",
  "coins",
  "banknote",
  "percent",
  "target",
  "flag",
  "map",
  "map-pin",
  "globe",
  "mail",
  "file",
  "file-text",
  "folder",
  "book-open",
  "info",
  "circle-help",
  "settings",
  "shield",
  "lock",
  "key",
  "wrench",
  "filter",
  "search",
  "list-checks",
];

/**
 * True when `value` names a catalog icon — the sidebar reads `icon` through
 * this so a bad name drops out of the nav while `assertPageIcon` reports it.
 *
 * @example
 * isPageIconName("calendar"); // true
 * isPageIconName("calender"); // false
 */
export function isPageIconName(value: unknown): value is string {
  return typeof value === "string" && PAGE_ICON_NAMES.includes(value);
}

const PAGE_ICON_CHOICES = `one of ${PAGE_ICON_NAMES.join(", ")}`;

/**
 * Checks a page's front-matter `icon` against the catalog. Absent, `null`
 * or `""` mean no icon. Any other value outside the catalog fails naming
 * the file and the closest name, rather than being dropped: a dropped icon
 * renders nothing and says nothing, so the typo looks like a bug. Names are
 * matched exactly, not normalized — the suggestion already turns
 * `Calendar` into `calendar`.
 *
 * @example
 * assertPageIcon("calender", "front-matter in pages/a.md");
 * // throws: Invalid front-matter in pages/a.md — icon: expected one of house, …, got "calender" (did you mean calendar?)
 */
export function assertPageIcon(icon: unknown, location: string): void {
  if (icon === undefined || icon === null || icon === "") return;
  if (isPageIconName(icon)) return;
  const hint =
    typeof icon === "string" ? didYouMean(icon, PAGE_ICON_NAMES) : "";
  throw invalidSetting(location, "icon", PAGE_ICON_CHOICES, icon, hint);
}
