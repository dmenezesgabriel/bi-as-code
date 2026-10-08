/**
 * The `@base-ui/react` Slider wrap site — dependency-cruiser keeps the
 * headless primitive library behind `src/web/src/components/` so widget
 * code never imports the package directly and the library stays
 * swappable. Re-exported as a namespace (`Slider.Root`/`Label`/`Value`/
 * `Control`/`Track`/`Thumb`/`Indicator`); widget-specific styling lives at
 * the use site.
 */
export { Slider } from "@base-ui/react/slider";
