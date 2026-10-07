/**
 * The `@base-ui/react` Combobox wrap site — dependency-cruiser keeps the
 * headless primitive library behind `src/web/src/components/` so widget
 * code never imports the package directly and the library stays
 * swappable. Re-exported as a namespace (`Combobox.Root`/`Trigger`/`Value`/
 * `Icon`/`Portal`/`Positioner`/`Popup`/`Input`/`Empty`/`List`/`Item`/
 * `ItemIndicator`/`Clear`/`Chips`/`Chip`/`ChipRemove`); widget-specific
 * styling lives at the use site.
 */
export { Combobox } from "@base-ui/react/combobox";
