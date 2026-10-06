/**
 * The `@base-ui/react` Accordion wrap site — dependency-cruiser keeps the
 * headless primitive library behind `src/web/src/components/` so widget
 * code never imports the package directly and the library stays
 * swappable. Re-exported as a namespace (`Accordion.Root`/`Item`/`Header`/
 * `Trigger`/`Panel`); widget-specific styling lives at the use site.
 */
export { Accordion } from "@base-ui/react/accordion";
