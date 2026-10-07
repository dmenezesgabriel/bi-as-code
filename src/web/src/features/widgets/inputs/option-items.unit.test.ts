import { describe, expect, it } from "vitest";
import {
  isOptionValueValid,
  parseOptionsProp,
  titleCase,
  toOptionItems,
} from "./option-items";

describe("toOptionItems — distinct derivation from rows", () => {
  it("maps valueColumn to options in fence order", () => {
    const rows = [
      { region: "West", label: "Western" },
      { region: "East", label: "Eastern" },
    ];
    expect(toOptionItems(rows, "region")).toEqual([
      { value: "West", label: undefined },
      { value: "East", label: undefined },
    ]);
  });

  it("carries labelColumn when given", () => {
    const rows = [{ region: "West", label: "Western" }];
    expect(toOptionItems(rows, "region", "label")).toEqual([
      { value: "West", label: "Western" },
    ]);
  });

  it("dedupes by value keeping the first row's label", () => {
    const rows = [
      { region: "West", label: "first" },
      { region: "West", label: "second" },
      { region: "East", label: "eastern" },
    ];
    expect(toOptionItems(rows, "region", "label")).toEqual([
      { value: "West", label: "first" },
      { value: "East", label: "eastern" },
    ]);
  });

  it("drops null and undefined values", () => {
    const rows = [
      { region: null },
      { region: "West" },
      { region: undefined },
      {},
    ];
    expect(toOptionItems(rows, "region")).toEqual([{ value: "West" }]);
  });

  it("stringifies non-string values", () => {
    const rows = [{ n: 42 }, { n: 7.5 }];
    expect(toOptionItems(rows, "n")).toEqual([
      { value: "42" },
      { value: "7.5" },
    ]);
  });

  it("treats a nullish label cell as no label", () => {
    const rows = [{ region: "West", label: null }];
    expect(toOptionItems(rows, "region", "label")).toEqual([
      { value: "West", label: undefined },
    ]);
  });
});

describe("parseOptionsProp — static options prop", () => {
  it("parses strings and numbers to value-only options", () => {
    expect(parseOptionsProp(["West", 42])).toEqual([
      { value: "West" },
      { value: "42" },
    ]);
  });

  it("parses {value, label} objects", () => {
    expect(
      parseOptionsProp([{ value: "w", label: "West" }, { value: 7 }]),
    ).toEqual([{ value: "w", label: "West" }, { value: "7" }]);
  });

  it("returns [] for a non-array prop", () => {
    expect(parseOptionsProp("West")).toEqual([]);
    expect(parseOptionsProp(undefined)).toEqual([]);
    expect(parseOptionsProp(null)).toEqual([]);
  });

  it("drops nulls, bad objects and non-string labels", () => {
    expect(
      parseOptionsProp([
        null,
        { label: "no value" },
        { value: "x", label: 7 },
        "kept",
      ]),
    ).toEqual([{ value: "kept" }]);
  });
});

describe("isOptionValueValid — the four states", () => {
  const loaded = {
    hasQueryResults: true,
    hasStaticOptions: false,
  } as const;

  it("accepts an empty/undefined value without validating", () => {
    expect(
      isOptionValueValid(undefined, new Set(), {
        hasQueryResults: false,
        hasStaticOptions: false,
      }),
    ).toBe(true);
    expect(isOptionValueValid("", new Set(["a"]), loaded)).toBe(true);
  });

  it("keeps the value while the options query is pending", () => {
    expect(
      isOptionValueValid("West", new Set(), {
        ...loaded,
        optionsQueryPending: true,
      }),
    ).toBe(true);
  });

  it("keeps the value when nothing is known yet", () => {
    expect(
      isOptionValueValid("West", new Set(), {
        hasQueryResults: false,
        hasStaticOptions: false,
      }),
    ).toBe(true);
  });

  it("keeps the value when options loaded empty", () => {
    expect(isOptionValueValid("West", new Set(), loaded)).toBe(true);
    expect(
      isOptionValueValid("West", new Set(), {
        hasQueryResults: false,
        hasStaticOptions: true,
      }),
    ).toBe(true);
  });

  it("validates membership once options are known", () => {
    const available = new Set(["West", "East"]);
    expect(isOptionValueValid("West", available, loaded)).toBe(true);
    expect(isOptionValueValid("Atlantis", available, loaded)).toBe(false);
  });
});

describe("titleCase — default placeholder text", () => {
  it("splits snake_case and kebab-case", () => {
    expect(titleCase("sales_region")).toBe("Sales Region");
    expect(titleCase("sales-region")).toBe("Sales Region");
  });

  it("splits camelCase boundaries", () => {
    expect(titleCase("salesRegion")).toBe("Sales Region");
  });

  it("capitalizes a plain word", () => {
    expect(titleCase("region")).toBe("Region");
  });
});
