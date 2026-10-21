import { describe, expect, it } from "vitest";
import {
  assertPageSearchFields,
  pageSearchFields,
} from "./page-search-frontmatter.js";

const LOCATION = "front-matter in pages/page.md";

describe("assertPageSearchFields — accepted", () => {
  it.each([{}, { index: true }, { index: false }, { index: null }])(
    "accepts %j",
    (frontmatter) => {
      expect(() => assertPageSearchFields(frontmatter, LOCATION)).not.toThrow();
    },
  );

  it.each([null, "margin", ["margin", "allocation"], []])(
    "accepts keywords %j",
    (keywords) => {
      const check = () => assertPageSearchFields({ keywords }, LOCATION);

      expect(check).not.toThrow();
    },
  );
});

describe("assertPageSearchFields — rejected", () => {
  it.each([
    ["no", '"no"'],
    [0, "0"],
    [["x"], '\\["x"\\]'],
  ])(
    "rejects index %j naming the file, key, shape and value",
    (index, shown) => {
      const check = () => assertPageSearchFields({ index }, LOCATION);

      expect(check).toThrow(
        new RegExp(
          `^Invalid front-matter in pages/page\\.md — index: expected true \\| false, got ${shown}$`,
        ),
      );
    },
  );

  it.each([
    [3, "3"],
    [["a", 2], '\\["a",2\\]'],
    [{ a: "b" }, '\\{"a":"b"\\}'],
  ])("rejects keywords %j", (keywords, shown) => {
    const check = () => assertPageSearchFields({ keywords }, LOCATION);

    expect(check).toThrow(
      new RegExp(
        `— keywords: expected a string or a list of strings, got ${shown}$`,
      ),
    );
  });
});

describe("pageSearchFields", () => {
  it("indexes a page that does not opt out", () => {
    expect(pageSearchFields({})).toEqual({ indexed: true, keywords: "" });
  });

  it("leaves a page with index: false out", () => {
    expect(pageSearchFields({ index: false }).indexed).toBe(false);
  });

  it("keeps a page with a malformed index in, as the compile error reports it", () => {
    expect(pageSearchFields({ index: "no" }).indexed).toBe(true);
  });

  it("reads keywords written as a string", () => {
    const fields = pageSearchFields({ keywords: "margin, allocation" });

    expect(fields.keywords).toBe("margin, allocation");
  });

  it("joins keywords written as a list", () => {
    const fields = pageSearchFields({ keywords: ["margin", "allocation"] });

    expect(fields.keywords).toBe("margin, allocation");
  });

  it("drops malformed keywords", () => {
    expect(pageSearchFields({ keywords: 3 }).keywords).toBe("");
  });
});
