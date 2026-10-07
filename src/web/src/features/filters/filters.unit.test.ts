import { describe, expect, it } from "vitest";
import { FakeFilterUrlPort } from "./fake-url-port";
import { Filters } from "./filters";

describe("Filters.ensure", () => {
  it("creates a filter whose predicate column defaults to the id", () => {
    const filters = new Filters(new FakeFilterUrlPort(""));
    const filter = filters.ensure("region");
    filter.value = "West";
    expect(filter.predicate()).toEqual({ sql: "region = ?", params: ["West"] });
  });

  it("honours an explicit column over the id", () => {
    const filters = new Filters(new FakeFilterUrlPort(""));
    const filter = filters.ensure("channel_filter", {
      column: "sales_channel",
    });
    filter.value = "Web";
    expect(filter.predicate()).toEqual({
      sql: "sales_channel = ?",
      params: ["Web"],
    });
  });

  it("defers to an existing filter — a second ensure never resets it", () => {
    const filters = new Filters(new FakeFilterUrlPort("?region=West"));
    const first = filters.ensure("region");
    const second = filters.ensure("region", { initialValue: "East" });
    expect(second).toBe(first);
    expect(second.value).toBe("West");
  });

  it("restores the value from the URL param at creation", () => {
    const filters = new Filters(new FakeFilterUrlPort("?region=West"));
    expect(filters.ensure("region").value).toBe("West");
  });
});

describe("Filters lookup", () => {
  it("get returns the filter and has reports membership", () => {
    const filters = new Filters(new FakeFilterUrlPort(""));
    filters.ensure("region");
    expect(filters.get("region")).toBeDefined();
    expect(filters.has("region")).toBe(true);
    expect(filters.get("missing")).toBeUndefined();
    expect(filters.has("missing")).toBe(false);
  });
});

describe("Filters.remove", () => {
  it("clears the value — deleting the URL param — then drops the filter", () => {
    const port = new FakeFilterUrlPort("?region=West");
    const filters = new Filters(port);
    filters.ensure("region");
    filters.remove("region");
    expect(port.written[0]!.searchParams.get("region")).toBeNull();
    expect(filters.has("region")).toBe(false);
  });

  it("is a no-op for an unknown id", () => {
    const port = new FakeFilterUrlPort("");
    const filters = new Filters(port);
    filters.remove("missing");
    expect(port.written).toHaveLength(0);
  });
});
