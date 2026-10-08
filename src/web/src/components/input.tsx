/**
 * The `@base-ui/react` Input wrap site — dependency-cruiser keeps the
 * headless primitive library behind `src/web/src/components/` so widget
 * code never imports the package directly and the library stays swappable.
 * `Input` renders a native `<input>` with Field integration (`value` +
 * `onValueChange` controlled, `defaultValue` uncontrolled); widget-specific
 * styling lives at the use site.
 */
export { Input } from "@base-ui/react/input";
