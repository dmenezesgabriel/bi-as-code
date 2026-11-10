/**
 * Packages Storybook's dev server pre-bundles at every start. Left to
 * discovery, Vite finds each of them when the first story that imports it
 * loads, re-optimizes dependencies mid-run, and answers the requests in
 * flight with `504 (Outdated Optimize Dep)`, so a story's lazy import fails
 * ("Failed to fetch dynamically imported module"). Listing them puts them in
 * the pre-bundle up front (https://vite.dev/guide/dep-pre-bundling).
 * `prebundled-deps.unit.test.ts` fails when the app or a story imports one of
 * these packages' entries without it being listed here.
 */
export const STORYBOOK_PREBUNDLED_DEPS: readonly string[] = [
  "@base-ui/react/accordion",
  "@base-ui/react/autocomplete",
  "@base-ui/react/collapsible",
  "@base-ui/react/combobox",
  "@base-ui/react/input",
  "@base-ui/react/menu",
  "@base-ui/react/popover",
  "@base-ui/react/slider",
  "@base-ui/react/switch",
  "@base-ui/react/tabs",
  "@base-ui/react/toggle",
  "@base-ui/react/toggle-group",
  "echarts/charts",
  "echarts/components",
  "echarts/core",
  "echarts/features",
  "echarts/renderers",
  "effect",
  "lucide-react",
  "shiki",
];
