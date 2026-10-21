/**
 * The `@base-ui/react` Menu wrap site — dependency-cruiser keeps the
 * headless primitive library behind `src/web/src/components/` so feature
 * code never imports the package directly and the library stays swappable.
 * Re-exported as a namespace (`Menu.Root`/`Trigger`/`Portal`/`Positioner`/
 * `Popup`/`RadioGroup`/`RadioItem`/`RadioItemIndicator`): `RadioGroup`
 * holds the checked value (`value` + `onValueChange` controlled) and each
 * `RadioItem` is a `menuitemradio` carrying `aria-checked`; styling lives at
 * the use site.
 */
export { Menu } from "@base-ui/react/menu";
