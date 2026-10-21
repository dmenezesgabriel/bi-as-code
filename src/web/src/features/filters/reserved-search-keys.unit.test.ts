import { describe, expect, it } from "vitest";
import { assertNotReservedSearchKey } from "./reserved-search-keys";

describe("assertNotReservedSearchKey", () => {
  it.each([
    ["edit", "opens the source editor in biac dev"],
    ["lang", "chooses the page language"],
  ])("rejects %s as a filter id, naming what it does", (filterId, owner) => {
    // Arrange / Act
    const assertion = () => assertNotReservedSearchKey(filterId);

    // Assert
    expect(assertion).toThrow(
      `Reserved filter id "${filterId}" — "${filterId}" ${owner}; choose another id`,
    );
  });

  it.each(["region", "Edit", "edited", "Lang", "language", "constructor"])(
    "accepts %s",
    (filterId) => {
      // Arrange / Act
      const assertion = () => assertNotReservedSearchKey(filterId);

      // Assert
      expect(assertion).not.toThrow();
    },
  );
});
