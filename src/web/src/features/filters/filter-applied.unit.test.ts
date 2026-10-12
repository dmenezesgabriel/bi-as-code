import { describe, expect, it } from "vitest";
import { FakeFilterUrlPort } from "./fake-url-port";
import { Filter } from "./filter";

type HeldValue = string | boolean | undefined;

function filterOn(search: string, column: string | false): Filter<HeldValue> {
  return new Filter<HeldValue>(
    "region",
    { column },
    new FakeFilterUrlPort(search),
  );
}

describe("Filter.isApplied", () => {
  describe("a filter that predicates a column", () => {
    it("is false while it holds nothing", () => {
      const filter = filterOn("", "region");

      expect(filter.isApplied).toBe(false);
    });

    it("is true once a value published its predicate", () => {
      const filter = filterOn("", "region");

      filter.value = "West";

      expect(filter.isApplied).toBe(true);
    });

    it("is true for a value seeded from the URL", () => {
      const filter = filterOn("?region=West", "region");

      expect(filter.isApplied).toBe(true);
    });

    it("is true for a programmatic default, which publishes too", () => {
      const filter = filterOn("", "region");

      filter.setDefault("West");

      expect(filter.isApplied).toBe(true);
    });

    it("stays false for a silently normalized value — held for display, filtering nothing", () => {
      const filter = filterOn("", "region");

      filter.normalize("West");

      expect(filter.value).toBe("West");
      expect(filter.isApplied).toBe(false);
    });

    it("is false again once the value is cleared", () => {
      const filter = filterOn("?region=West", "region");

      filter.value = "";

      expect(filter.isApplied).toBe(false);
    });
  });

  describe("a filter read through params only", () => {
    it("is true while it holds a value", () => {
      const filter = filterOn("", false);

      filter.value = true;

      expect(filter.isApplied).toBe(true);
    });

    it("is false for a switched-off or cleared value", () => {
      const filter = filterOn("", false);

      filter.value = false;

      expect(filter.isApplied).toBe(false);
    });
  });

  describe("listeners", () => {
    it.each([
      [
        "a value write",
        (filter: Filter<HeldValue>) => {
          filter.value = "West";
        },
      ],
      [
        "a programmatic default",
        (filter: Filter<HeldValue>) => {
          filter.setDefault("West");
        },
      ],
    ])("see the applied state of %s when notified", (_label, write) => {
      const filter = filterOn("", "region");
      const seen: boolean[] = [];
      filter.subscribe(() => seen.push(filter.isApplied));

      write(filter);

      expect(seen).toEqual([true]);
    });

    it("are notified when a column swap changes the applied state", () => {
      const filter = filterOn("", false);
      filter.normalize("West");
      const seen: boolean[] = [];
      filter.subscribe(() => seen.push(filter.isApplied));

      filter.configure({ column: "region" });

      expect(seen).toEqual([true]);
    });
  });
});
