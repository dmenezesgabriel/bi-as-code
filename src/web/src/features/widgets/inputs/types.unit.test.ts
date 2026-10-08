import { describe, expectTypeOf, it } from "vitest";
import type { FilterIds } from "../../filters/filter-ids";
import type {
  ButtonGroupProps,
  DropdownProps,
  FilterSelectProps,
  MultiSelectProps,
  OptionItem,
} from "./types";

/**
 * The input widgets' authored MDX surface — the component contract T2/T3
 * implement against. `expectTypeOf` pins the prop shapes so the tags land
 * already-typed.
 */
describe("input widget prop types", () => {
  it("OptionItem is a string value with an optional label", () => {
    expectTypeOf<OptionItem["value"]>().toEqualTypeOf<string>();
    expectTypeOf<OptionItem["label"]>().toEqualTypeOf<string | undefined>();
  });

  it("Dropdown requires only an id and takes the shared input props", () => {
    expectTypeOf<DropdownProps["id"]>().toEqualTypeOf<string>();
    expectTypeOf<DropdownProps["data"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<DropdownProps["valueColumn"]>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<DropdownProps["filters"]>().toEqualTypeOf<
      FilterIds | undefined
    >();
    expectTypeOf<DropdownProps["initialValue"]>().toEqualTypeOf<
      string | undefined
    >();
  });

  it("MultiSelect takes an array initialValue and defaultTopN", () => {
    expectTypeOf<MultiSelectProps["initialValue"]>().toEqualTypeOf<
      readonly string[] | undefined
    >();
    expectTypeOf<MultiSelectProps["defaultTopN"]>().toEqualTypeOf<
      number | undefined
    >();
  });

  it("FilterSelectProps carries the internal multiple flag", () => {
    expectTypeOf<FilterSelectProps["multiple"]>().toEqualTypeOf<boolean>();
    expectTypeOf<FilterSelectProps["initialValue"]>().toEqualTypeOf<
      string | readonly string[] | undefined
    >();
  });

  it("ButtonGroup takes the option-list contract minus defaultTopN", () => {
    expectTypeOf<ButtonGroupProps["multiple"]>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<ButtonGroupProps["selectFirst"]>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<ButtonGroupProps["initialValue"]>().toEqualTypeOf<
      string | readonly string[] | undefined
    >();
    expectTypeOf<ButtonGroupProps["title"]>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<ButtonGroupProps>().not.toHaveProperty("defaultTopN");
    expectTypeOf<ButtonGroupProps>().not.toHaveProperty("search");
    expectTypeOf<ButtonGroupProps>().not.toHaveProperty("placeholder");
  });
});
