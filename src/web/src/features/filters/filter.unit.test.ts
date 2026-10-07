import { describe, expect, it } from "vitest";
import { FakeFilterUrlPort } from "./fake-url-port";
import { Filter, type FilterOptions } from "./filter";

/** JSON-array round-trip, the shape a multi-value input will pass (SL-010). */
const listOptions: FilterOptions<string | string[]> = {
  column: "region",
  serialize: (value) => {
    if (value === undefined) return undefined;
    return Array.isArray(value) ? JSON.stringify(value) : value;
  },
  deserialize: (raw) => {
    if (raw.startsWith("[")) return JSON.parse(raw) as string[];
    return raw;
  },
};

describe("Filter construction — value priority", () => {
  it("takes the URL param over initialValue and deserializes it", () => {
    const filter = new Filter<string | string[]>(
      "region",
      listOptions,
      new FakeFilterUrlPort("?region=West"),
    );
    expect(filter.value).toBe("West");
  });

  it("falls back to initialValue when the URL has no param — including falsy values", () => {
    const falsy = new Filter<boolean>(
      "show",
      { initialValue: false },
      new FakeFilterUrlPort(""),
    );
    expect(falsy.value).toBe(false);
  });

  it("stays undefined with no URL param and no initialValue", () => {
    const filter = new Filter<string | string[]>(
      "region",
      listOptions,
      new FakeFilterUrlPort(""),
    );
    expect(filter.value).toBeUndefined();
  });

  it("treats an empty URL value (?id=) as no param", () => {
    const filter = new Filter<string | string[]>(
      "region",
      listOptions,
      new FakeFilterUrlPort("?region="),
    );
    expect(filter.value).toBeUndefined();
  });

  it("writes nothing to the URL during construction", () => {
    const port = new FakeFilterUrlPort("");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    expect(filter.value).toBeUndefined();
    expect(port.written).toHaveLength(0);
  });
});

describe("Filter.value — user interaction", () => {
  it("updates state and writes the param", () => {
    const port = new FakeFilterUrlPort("");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.value = "West";
    expect(filter.value).toBe("West");
    expect(port.written).toHaveLength(1);
    expect(port.written[0]!.searchParams.get("region")).toBe("West");
  });

  it("serializes arrays as JSON", () => {
    const port = new FakeFilterUrlPort("");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.value = ["West", "East"];
    expect(port.written[0]!.searchParams.get("region")).toBe('["West","East"]');
  });

  it("deletes the param when cleared to undefined", () => {
    const port = new FakeFilterUrlPort("?region=West&keep=1");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.value = undefined;
    expect(port.written[0]!.searchParams.get("region")).toBeNull();
    expect(port.written[0]!.searchParams.get("keep")).toBe("1");
  });

  it("deletes the param when the value serializes to empty", () => {
    const port = new FakeFilterUrlPort("?region=West");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.value = "";
    expect(port.written[0]!.searchParams.get("region")).toBeNull();
  });

  it("skips the URL write when re-asserting the serialized value (echo guard)", () => {
    const port = new FakeFilterUrlPort("?region=West");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.value = "West";
    expect(port.written).toHaveLength(0);
  });

  it("leaves other params untouched when writing", () => {
    const port = new FakeFilterUrlPort("?channel=Web");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.value = "West";
    expect(port.written[0]!.searchParams.get("channel")).toBe("Web");
  });

  it("updates state without writing when the port has no URL", () => {
    const port = new FakeFilterUrlPort(undefined);
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.value = "West";
    expect(filter.value).toBe("West");
    expect(port.written).toHaveLength(0);
  });
});

describe("Filter.setDefault — programmatic default", () => {
  it("updates state and never writes the URL", () => {
    const port = new FakeFilterUrlPort("");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.setDefault("West");
    expect(filter.value).toBe("West");
    expect(port.written).toHaveLength(0);
  });

  it("absorbs a later echo of the default into a no-op", () => {
    const port = new FakeFilterUrlPort("");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.setDefault("West");
    filter.value = "West";
    expect(port.written).toHaveLength(0);
  });

  it("still writes when the user then picks a different value", () => {
    const port = new FakeFilterUrlPort("");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.setDefault("West");
    filter.value = "East";
    expect(port.written[0]!.searchParams.get("region")).toBe("East");
  });
});

describe("Filter.normalize — constrained correction", () => {
  it("writes the URL when the param is already present", () => {
    const port = new FakeFilterUrlPort("?region=9999");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.normalize("5000");
    expect(filter.value).toBe("5000");
    expect(port.written[0]!.searchParams.get("region")).toBe("5000");
  });

  it("behaves as a default when no param is present", () => {
    const port = new FakeFilterUrlPort("");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.normalize("5000");
    expect(filter.value).toBe("5000");
    expect(port.written).toHaveLength(0);
  });
});

describe("Filter.applySerialized — set from the URL-param form", () => {
  it("deserializes and writes as a user interaction", () => {
    const port = new FakeFilterUrlPort("");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.applySerialized('["West","East"]');
    expect(filter.value).toEqual(["West", "East"]);
    expect(port.written).toHaveLength(1);
  });

  it("clears when the raw is undefined", () => {
    const port = new FakeFilterUrlPort("?region=West");
    const filter = new Filter<string | string[]>("region", listOptions, port);
    filter.applySerialized(undefined);
    expect(filter.value).toBeUndefined();
    expect(port.written[0]!.searchParams.get("region")).toBeNull();
  });
});

describe("Filter.predicate — placeholder-bound column predicate", () => {
  it("is undefined without a column", () => {
    const filter = new Filter<string>("region", {}, new FakeFilterUrlPort(""));
    filter.value = "West";
    expect(filter.predicate()).toBeUndefined();
  });

  it("binds a single value as `column = ?`", () => {
    const filter = new Filter<string>(
      "region",
      { column: "region" },
      new FakeFilterUrlPort(""),
    );
    filter.value = "West";
    expect(filter.predicate()).toEqual({ sql: "region = ?", params: ["West"] });
  });

  it("binds an array as `column IN (?, …)`", () => {
    const filter = new Filter<string | string[]>(
      "region",
      listOptions,
      new FakeFilterUrlPort(""),
    );
    filter.value = ["West", "East"];
    expect(filter.predicate()).toEqual({
      sql: "region IN (?, ?)",
      params: ["West", "East"],
    });
  });

  it("is undefined for an empty array, null and empty string", () => {
    const empty = new Filter<string | string[]>(
      "region",
      listOptions,
      new FakeFilterUrlPort(""),
    );
    empty.value = [];
    expect(empty.predicate()).toBeUndefined();
    const blank = new Filter<string>(
      "region",
      { column: "region" },
      new FakeFilterUrlPort(""),
    );
    blank.value = "";
    expect(blank.predicate()).toBeUndefined();
  });
});

describe("Filter reactivity", () => {
  it("notifies subscribers on a value change and on setDefault", () => {
    const filter = new Filter<string | string[]>(
      "region",
      listOptions,
      new FakeFilterUrlPort(""),
    );
    const seen: (string | string[] | undefined)[] = [];
    filter.subscribe(() => seen.push(filter.getSnapshot()));
    filter.value = "West";
    filter.setDefault("East");
    expect(seen).toEqual(["West", "East"]);
  });

  it("does not notify when the value is re-asserted", () => {
    const filter = new Filter<string | string[]>(
      "region",
      listOptions,
      new FakeFilterUrlPort(""),
    );
    let calls = 0;
    filter.subscribe(() => {
      calls += 1;
    });
    filter.value = "West";
    filter.value = "West";
    expect(calls).toBe(1);
  });

  it("stops notifying after unsubscribe", () => {
    const filter = new Filter<string | string[]>(
      "region",
      listOptions,
      new FakeFilterUrlPort(""),
    );
    let calls = 0;
    const unsubscribe = filter.subscribe(() => {
      calls += 1;
    });
    unsubscribe();
    filter.value = "West";
    expect(calls).toBe(0);
  });

  it("exposes the serialized form via serializedValue", () => {
    const filter = new Filter<string | string[]>(
      "region",
      listOptions,
      new FakeFilterUrlPort(""),
    );
    filter.value = ["West", "East"];
    expect(filter.serializedValue).toBe('["West","East"]');
  });
});
