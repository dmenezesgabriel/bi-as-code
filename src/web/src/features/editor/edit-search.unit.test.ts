import { describe, expect, it } from "vitest";
import { isEditSearch } from "./edit-search";

describe("isEditSearch", () => {
  it.each([
    ["bare ?edit", { edit: "" }],
    ["?edit=true", { edit: true }],
    ["alongside a filter", { region: "West", edit: true }],
  ])("opens the editor for %s", (_case, search) => {
    // Arrange / Act / Assert
    expect(isEditSearch(search)).toBe(true);
  });

  it.each([
    ["no edit param", { region: "West" }],
    ["?edit=false", { edit: false }],
  ])("keeps the plain page for %s", (_case, search) => {
    // Arrange / Act / Assert
    expect(isEditSearch(search)).toBe(false);
  });
});
