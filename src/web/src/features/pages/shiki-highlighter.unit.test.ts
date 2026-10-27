import { describe, expect, it } from "vitest";
import { highlightFence } from "./shiki-highlighter";

/** The distinct css-variables token colours shiki painted in `html`. */
function tokenColours(html: string): Set<string> {
  return new Set(html.match(/--shiki-token-[\w-]+/g) ?? []);
}

describe("highlightFence", () => {
  it("tokenizes the JSX in an mdx fence, not just its markdown", async () => {
    const html = await highlightFence(
      "mdx",
      '<BarChart data="region_share" x="region" />',
    );

    expect(tokenColours(html ?? "").size).toBeGreaterThan(1);
  });

  it("returns null for a language shiki does not bundle", async () => {
    const html = await highlightFence("no-such-language", "text");

    expect(html).toBeNull();
  });
});
