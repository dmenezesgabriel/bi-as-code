import { describe, expect, it } from "vitest";
import { assertPageChrome, pageChrome } from "./page-chrome-frontmatter.js";

const LOCATION = "front-matter in pages/embed.md";

describe("assertPageChrome — accepted", () => {
  it.each([
    {},
    { sidebar: false },
    { header: false },
    { sidebar: true, header: false },
  ])("accepts %j", (frontmatter) => {
    expect(() => assertPageChrome(frontmatter, LOCATION)).not.toThrow();
  });
});

describe("assertPageChrome — rejected", () => {
  it.each([
    ["sidebar", "no", '"no"'],
    ["header", 0, "0"],
    ["header", null, "null"],
  ])(
    "rejects %s: %j naming the file, key, shape and value",
    (key, value, shown) => {
      const check = () => assertPageChrome({ [key]: value }, LOCATION);

      expect(check).toThrow(
        `Invalid front-matter in pages/embed.md — ${key}: expected a boolean, got ${shown}`,
      );
    },
  );
});

describe("pageChrome", () => {
  it("keeps the switches a page sets", () => {
    const chrome = pageChrome({ sidebar: false, header: true, title: "A" });

    expect(chrome).toEqual({ sidebar: false, header: true });
  });

  it("leaves out an absent switch so the project default still applies", () => {
    expect(pageChrome({})).toEqual({});
  });

  it("drops a non-boolean rather than breaking the manifest", () => {
    expect(pageChrome({ sidebar: "no", header: null })).toEqual({});
  });
});
