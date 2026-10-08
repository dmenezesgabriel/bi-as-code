/**
 * The `@base-ui/react` Popover wrap site — dependency-cruiser keeps the
 * headless primitive library behind `src/web/src/components/` so widget
 * code never imports the package directly and the library stays swappable.
 * Re-exported as a namespace (`Popover.Root`/`Trigger`/`Portal`/
 * `Positioner`/`Popup`/`Close`): `Root` holds open state (`open` +
 * `onOpenChange` controlled), `Trigger` the anchor, `Popup` the portalized
 * surface; widget-specific styling lives at the use site.
 */
export { Popover } from "@base-ui/react/popover";
