import { describe, expect, it } from "vitest";
import { routeOfPathname } from "./route-of-pathname";

describe("routeOfPathname", () => {
  it.each([
    ["/", "/"],
    ["/weekly-review/", "/weekly-review"],
    ["/weekly-review", "/weekly-review"],
    ["/nested/allocation/", "/nested/allocation"],
  ])(
    "maps the location pathname %s to the manifest route %s",
    (path, route) => {
      // Act
      const matched = routeOfPathname(path);

      // Assert
      expect(matched).toBe(route);
    },
  );
});
