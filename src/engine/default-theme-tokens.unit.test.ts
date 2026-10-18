import { describe, expect, it } from "vitest";
import { ruleBody, tokenIn } from "../../test/lib/stylesheet-tokens.js";
import {
  DEFAULT_THEME_TOKENS,
  type ThemeTokenName,
} from "./default-theme-tokens.js";

describe.each([
  ["light", ":root,\n.light"],
  ["dark", ".dark"],
] as const)("the %s default theme tokens", (mode, selector) => {
  const body = ruleBody(selector);
  const names = Object.keys(DEFAULT_THEME_TOKENS[mode]) as ThemeTokenName[];

  it.each(names)("match %s in styles.css", (name) => {
    const declared = tokenIn(body, name);

    expect(DEFAULT_THEME_TOKENS[mode][name]).toBe(declared);
  });
});
