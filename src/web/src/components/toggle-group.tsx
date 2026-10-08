/**
 * The `@base-ui/react` ToggleGroup wrap site — dependency-cruiser keeps the
 * headless primitive library behind `src/web/src/components/` so widget
 * code never imports the package directly and the library stays swappable.
 * `ToggleGroup` is the root (a `role="group"` div with roving focus);
 * `Toggle` is the item primitive it coordinates — pressed state renders as
 * `aria-pressed`/`data-pressed`. Widget-specific styling lives at the use
 * site.
 */
export { ToggleGroup } from "@base-ui/react/toggle-group";
export { Toggle } from "@base-ui/react/toggle";
