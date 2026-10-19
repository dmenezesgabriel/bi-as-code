import { describe, expect, it } from "vitest";
import { closestKey, didYouMean } from "./closest-key.js";

const CONFIG_KEYS = ["title", "theme", "nav", "sql", "interpreters"];

describe("closestKey — matches", () => {
  it("suggests the key that differs only in case", () => {
    const candidate = "Title";

    const suggestion = closestKey(candidate, CONFIG_KEYS);

    expect(suggestion).toBe("title");
  });

  it("suggests a key two edits away", () => {
    const candidate = "titel";

    const suggestion = closestKey(candidate, CONFIG_KEYS);

    expect(suggestion).toBe("title");
  });

  it("suggests a key with one letter missing", () => {
    const candidate = "sidebr";

    const suggestion = closestKey(candidate, ["sidebar"]);

    expect(suggestion).toBe("sidebar");
  });

  it("breaks a tie by declaration order", () => {
    const candidate = "thme";

    const suggestion = closestKey(candidate, ["theme", "them"]);

    expect(suggestion).toBe("theme");
  });
});

describe("closestKey — no match", () => {
  it("suggests nothing when every key is more than two edits away", () => {
    const candidate = "pagewidth";

    const suggestion = closestKey(candidate, CONFIG_KEYS);

    expect(suggestion).toBeUndefined();
  });

  it("suggests nothing when no key is accepted", () => {
    const candidate = "title";

    const suggestion = closestKey(candidate, []);

    expect(suggestion).toBeUndefined();
  });
});

describe("didYouMean", () => {
  it("names the closest accepted key as a parenthesised hint", () => {
    const hint = didYouMean("titel", CONFIG_KEYS);

    expect(hint).toBe(" (did you mean title?)");
  });

  it("is empty when nothing is close", () => {
    const hint = didYouMean("pagewidth", CONFIG_KEYS);

    expect(hint).toBe("");
  });
});
