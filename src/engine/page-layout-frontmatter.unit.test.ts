import { describe, expect, it } from "vitest";
import { pageLayout } from "./page-layout-frontmatter.js";

const LOCATION = "front-matter in pages/page.md";

describe("pageLayout", () => {
  it("leaves page_width unset when the front-matter has none", () => {
    expect(pageLayout({ title: "T" }, LOCATION)).toEqual({});
  });

  it("carries page_width article and full", () => {
    expect(pageLayout({ page_width: "article" }, LOCATION)).toEqual({
      page_width: "article",
    });
    expect(pageLayout({ page_width: "full" }, LOCATION)).toEqual({
      page_width: "full",
    });
  });

  it("throws naming the file, the field, the accepted values and the value", () => {
    expect(() => pageLayout({ page_width: "wide" }, LOCATION)).toThrow(
      'Invalid front-matter in pages/page.md — page_width: expected "article" | "full", got "wide"',
    );
  });

  it("rejects a non-string page_width", () => {
    expect(() => pageLayout({ page_width: true }, LOCATION)).toThrow(
      /page_width: expected "article" \| "full", got true$/,
    );
  });

  it("carries cards true and false", () => {
    expect(pageLayout({ cards: true }, LOCATION)).toEqual({ cards: true });
    expect(pageLayout({ cards: false }, LOCATION)).toEqual({ cards: false });
  });

  it("carries page_width and cards together", () => {
    expect(pageLayout({ page_width: "full", cards: true }, LOCATION)).toEqual({
      page_width: "full",
      cards: true,
    });
  });

  it("rejects a non-boolean cards naming the file and the value", () => {
    expect(() => pageLayout({ cards: "yes" }, LOCATION)).toThrow(
      'Invalid front-matter in pages/page.md — cards: expected a boolean, got "yes"',
    );
  });
});
