import { describe, expect, it } from "vitest";
import { assertPageIcon, isPageIconName } from "./page-icon-frontmatter.js";

const LOCATION = "front-matter in pages/page.md";

describe("assertPageIcon — accepted", () => {
  it.each([undefined, null, ""])("accepts %j as no icon", (icon) => {
    expect(() => assertPageIcon(icon, LOCATION)).not.toThrow();
  });

  it.each(["house", "calendar", "chart-line", "list-checks"])(
    "accepts the catalog name %s",
    (icon) => {
      expect(() => assertPageIcon(icon, LOCATION)).not.toThrow();
    },
  );
});

describe("assertPageIcon — rejected", () => {
  it("names the file, the key, the catalog, the value and the closest name", () => {
    const check = () => assertPageIcon("calender", LOCATION);

    expect(check).toThrow(
      /^Invalid front-matter in pages\/page\.md — icon: expected one of house, layout-dashboard, .*, list-checks, got "calender" \(did you mean calendar\?\)$/,
    );
  });

  it("suggests the catalog spelling of a name written in another case", () => {
    const check = () => assertPageIcon("Calendar", LOCATION);

    expect(check).toThrow(/got "Calendar" \(did you mean calendar\?\)$/);
  });

  it("suggests nothing when no catalog name is close", () => {
    const check = () => assertPageIcon("zzzz", LOCATION);

    expect(check).toThrow(/, list-checks, got "zzzz"$/);
  });

  it("rejects a non-string icon", () => {
    const check = () => assertPageIcon(3, LOCATION);

    expect(check).toThrow(/icon: expected one of house, .*, got 3$/);
  });
});

describe("isPageIconName", () => {
  it("is true for a catalog name", () => {
    expect(isPageIconName("chart-line")).toBe(true);
  });

  it.each([undefined, null, "", "calender", "Calendar", 3])(
    "is false for %j",
    (value) => {
      expect(isPageIconName(value)).toBe(false);
    },
  );
});
