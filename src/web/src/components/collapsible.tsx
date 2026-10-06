/**
 * The `@base-ui/react` Collapsible wrap site — dependency-cruiser keeps the
 * headless primitive library behind `src/web/src/components/` so widget
 * code never imports the package directly and the library stays swappable.
 * Re-exported as a namespace (`Collapsible.Root`/`Trigger`/`Panel`);
 * widget-specific styling lives at the use site.
 */
export { Collapsible } from "@base-ui/react/collapsible";
