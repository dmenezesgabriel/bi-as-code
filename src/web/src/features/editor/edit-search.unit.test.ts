import { describe, expect, it } from "vitest";
import {
  assertNotEditorSearchKey,
  isEditSearch,
  searchWithoutEditorKey,
} from "./edit-search";

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

describe("searchWithoutEditorKey", () => {
  it.each([
    ["?edit=true", { region: "West", edit: true }],
    ["bare ?edit", { region: "West", edit: "" }],
    ["a non-flag value", { region: "West", edit: "West" }],
    ["?edit=false", { region: "West", edit: false }],
  ])("drops the editor's key for %s and keeps the rest", (_case, search) => {
    // Arrange / Act
    const visible = searchWithoutEditorKey(search);

    // Assert
    expect(visible).toEqual({ region: "West" });
  });

  it("returns the same object when the editor's key is absent", () => {
    // Arrange
    const search = { region: "West" };

    // Act
    const visible = searchWithoutEditorKey(search);

    // Assert
    expect(visible).toBe(search);
  });

  it("leaves the search it was given untouched", () => {
    // Arrange
    const search = { region: "West", edit: true };

    // Act
    searchWithoutEditorKey(search);

    // Assert
    expect(search).toEqual({ region: "West", edit: true });
  });
});

describe("assertNotEditorSearchKey", () => {
  it("rejects the editor's key as a filter id, naming it", () => {
    // Arrange / Act
    const assertion = () => assertNotEditorSearchKey("edit");

    // Assert
    expect(assertion).toThrow(
      'Reserved filter id "edit" — "edit" opens the source editor in biac dev; choose another id',
    );
  });

  it.each(["region", "Edit", "edited"])("accepts %s", (filterId) => {
    // Arrange / Act
    const assertion = () => assertNotEditorSearchKey(filterId);

    // Assert
    expect(assertion).not.toThrow();
  });
});
