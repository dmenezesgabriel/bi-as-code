/**
 * The `@base-ui/react` Switch wrap site — dependency-cruiser keeps the
 * headless primitive library behind `src/web/src/components/` so widget
 * code never imports the package directly and the library stays swappable.
 * Re-exported as a namespace (`Switch.Root`/`Switch.Thumb`): the root is a
 * `role="switch"` control (`checked` + `onCheckedChange` controlled,
 * `defaultChecked` uncontrolled); widget-specific styling lives at the use
 * site.
 */
export { Switch } from "@base-ui/react/switch";
