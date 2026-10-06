/**
 * The `@base-ui/react` Tabs wrap site — dependency-cruiser keeps the
 * headless primitive library behind `src/web/src/components/` so widget
 * code never imports the package directly and the library stays
 * swappable. Re-exported as a namespace (`Tabs.Root`/`List`/`Tab`/
 * `Indicator`/`Panel`); widget-specific styling lives at the use site.
 */
export { Tabs } from "@base-ui/react/tabs";
