import { describe, expect, it, vi } from "vitest";
import { FakeFilterUrlPort } from "./fake-url-port";
import { FilterRoster } from "./filter-roster";
import { Filters } from "./filters";

function pageFilters(search = ""): Filters {
  return new Filters(new FakeFilterUrlPort(search));
}

describe("FilterRoster", () => {
  describe("getSnapshot", () => {
    it("is 0 with no members", () => {
      const roster = new FilterRoster();

      expect(roster.getSnapshot()).toBe(0);
    });

    it("counts only the members that are applied", () => {
      const filters = pageFilters("?region=West");
      const roster = new FilterRoster();

      roster.enlist(filters.ensure("region"));
      roster.enlist(filters.ensure("channel"));

      expect(roster.getSnapshot()).toBe(1);
    });

    it("counts a filter enlisted twice once", () => {
      const filters = pageFilters("?region=West");
      const roster = new FilterRoster();

      roster.enlist(filters.ensure("region"));
      roster.enlist(filters.ensure("region"));

      expect(roster.getSnapshot()).toBe(1);
    });

    it("keeps a twice-enlisted filter until its last enlistment ends", () => {
      const filters = pageFilters("?region=West");
      const roster = new FilterRoster();
      const leaveFirst = roster.enlist(filters.ensure("region"));
      const leaveSecond = roster.enlist(filters.ensure("region"));

      leaveFirst();
      const countAfterFirst = roster.getSnapshot();
      leaveSecond();

      expect(countAfterFirst).toBe(1);
      expect(roster.getSnapshot()).toBe(0);
    });
  });

  describe("subscribe", () => {
    it("notifies when a member enlists and when it leaves", () => {
      const filters = pageFilters("?region=West");
      const roster = new FilterRoster();
      const listener = vi.fn();
      roster.subscribe(listener);

      const leave = roster.enlist(filters.ensure("region"));
      leave();

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("notifies when a member's value changes", () => {
      const filters = pageFilters();
      const region = filters.ensure<string>("region");
      const roster = new FilterRoster();
      roster.enlist(region);
      const listener = vi.fn();
      roster.subscribe(listener);

      region.value = "West";

      expect(listener).toHaveBeenCalledTimes(1);
      expect(roster.getSnapshot()).toBe(1);
    });

    it("stops following a member that left", () => {
      const filters = pageFilters();
      const region = filters.ensure<string>("region");
      const roster = new FilterRoster();
      const leave = roster.enlist(region);
      leave();
      const listener = vi.fn();
      roster.subscribe(listener);

      region.value = "West";

      expect(listener).not.toHaveBeenCalled();
      expect(roster.getSnapshot()).toBe(0);
    });

    it("stops notifying a listener that unsubscribed", () => {
      const filters = pageFilters();
      const roster = new FilterRoster();
      const listener = vi.fn();
      const unsubscribe = roster.subscribe(listener);

      unsubscribe();
      roster.enlist(filters.ensure("region"));

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
