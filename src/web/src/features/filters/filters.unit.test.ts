import { describe, expect, it } from "vitest";
import { FakeFilterUrlPort } from "./fake-url-port";
import type { FilterOptions } from "./filter";
import { Filters } from "./filters";

const ARRAY_CODEC: FilterOptions<string | string[]> = {
  serialize: (value) => {
    if (value === undefined || value === "") return undefined;
    return Array.isArray(value) ? JSON.stringify(value) : value;
  },
  deserialize: (raw) => (raw.startsWith("[") ? JSON.parse(raw) : raw),
};

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

  it("applies an input's options to a filter a consumer created first", () => {
    const port = new FakeFilterUrlPort('?channel=["a","b"]');
    const filters = new Filters(port);
    // Widget-first order: the consumer's bare ensure holds a mis-decoded
    // string until the input's codec arrives.
    const bare = filters.ensure("channel");
    const configured = filters.ensure("channel", {
      column: "sales_channel",
      ...ARRAY_CODEC,
    });
    expect(configured).toBe(bare);
    expect(configured.value).toEqual(["a", "b"]);
    expect(configured.predicate()).toEqual({
      sql: "sales_channel IN (?, ?)",
      params: ["a", "b"],
    });
    expect(port.written).toHaveLength(0);
  });

  it("keeps an input's options when a consumer's bare ensure lands second", () => {
    const filters = new Filters(new FakeFilterUrlPort(""));
    filters.ensure<string | string[]>("channel", {
      column: "sales_channel",
      ...ARRAY_CODEC,
    });
    const second = filters.ensure("channel");
    second.value = ["a", "b"];
    expect(second.predicate()).toEqual({
      sql: "sales_channel IN (?, ?)",
      params: ["a", "b"],
    });
  });

  it("seeds initialValue via setDefault when the existing value is unset", () => {
    const port = new FakeFilterUrlPort("");
    const filters = new Filters(port);
    filters.ensure("region");
    filters.ensure("region", { initialValue: "West" });
    expect(filters.get("region")?.value).toBe("West");
    expect(port.written).toHaveLength(0);
  });

  it("skips initialValue when the existing filter already holds a value", () => {
    const filters = new Filters(new FakeFilterUrlPort("?region=West"));
    filters.ensure("region");
    filters.ensure("region", { initialValue: "East" });
    expect(filters.get("region")?.value).toBe("West");
  });

  it("restores the value from the URL param at creation", () => {
    const filters = new Filters(new FakeFilterUrlPort("?region=West"));
    expect(filters.ensure("region").value).toBe("West");
  });

  it("honours `column: false` over the id default — the filter never predicates", () => {
    const filters = new Filters(new FakeFilterUrlPort(""));
    const filter = filters.ensure("q", { column: false });
    filter.value = "north";
    expect(filter.predicate()).toBeUndefined();
  });

  it("keeps `column: false` when a consumer's bare ensure lands second", () => {
    const filters = new Filters(new FakeFilterUrlPort(""));
    filters.ensure("q", { column: false });
    const filter = filters.ensure("q");
    filter.value = "north";
    expect(filter.predicate()).toBeUndefined();
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
