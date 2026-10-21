/**
 * The `@base-ui/react` Autocomplete wrap site — dependency-cruiser keeps the
 * headless primitive library behind `src/web/src/components/` so feature
 * code never imports the package directly and the library stays
 * swappable. Re-exported as a namespace (`Autocomplete.Root`/`Input`/
 * `List`/`Item`/`Empty`/…): a combobox whose input is free text and whose
 * items are suggestions, with `role="listbox"`/`option`, arrow keys and
 * `aria-activedescendant` built in; styling lives at the use site.
 */
export { Autocomplete } from "@base-ui/react/autocomplete";
