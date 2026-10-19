import { describe, expect, it } from "vitest";
import { PAGE_ICON_NAMES } from "../../src/engine/page-icon-frontmatter.js";
import { PAGE_ICONS } from "../../src/web/src/components/page-icon-catalog.js";

// The SPA never imports the engine, so the catalog lives twice: the names
// the engine accepts and the glyphs the sidebar can draw. A name on one side
// only would either fail a valid page or silently draw nothing.
describe("page icon catalog", () => {
  it("names the same icons in the engine and the SPA", () => {
    const engineNames = [...PAGE_ICON_NAMES].sort();

    const webNames = Object.keys(PAGE_ICONS).sort();

    expect(webNames).toEqual(engineNames);
  });
});
