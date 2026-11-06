import { describe, expect, it } from "vitest";
import { clauseInterval, clausePoint } from "../crossfilter/clause";
import type {
  FilterPredicate,
  IntervalExtent,
  QueryClient,
} from "../crossfilter/types";
import { FakeFilterUrlPort } from "./fake-url-port";
import { Filter, type FilterOptions } from "./filter";

/** JSON-array round-trip, the shape a multi-value input passes. */
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

/** The bound predicate of the clause this filter published, `undefined` when it holds none. */
function publishedPredicate<V>(filter: Filter<V>): FilterPredicate | undefined {
  return (
    filter.selection.clauses.find((clause) => clause.source === filter)
      ?.predicate ?? undefined
  );
}

/** An inert `QueryClient` — only its identity matters for `clients` sets. */
const stubClient: QueryClient = {
  query: () => undefined,
  queryPending: () => {},
  queryResult: () => {},
  queryError: () => {},
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

describe("Filter clause publication — value change publishes into its selection", () => {
  it("publishes nothing without a column", () => {
    const filter = new Filter<string>("region", {}, new FakeFilterUrlPort(""));
    filter.value = "West";
    expect(publishedPredicate(filter)).toBeUndefined();
  });

  it("publishes the URL-seeded value at construction", () => {
    const filter = new Filter<string>(
      "region",
      { column: "region" },
      new FakeFilterUrlPort("?region=West"),
    );
    expect(publishedPredicate(filter)).toEqual({
      sql: "region = ?",
      params: ["West"],
    });
  });

  it("binds a single value as a point clause `column = ?` with itself as source", () => {
    const filter = new Filter<string>(
      "region",
      { column: "region" },
      new FakeFilterUrlPort(""),
    );
    filter.value = "West";
    const clause = filter.selection.clauses[0];
    expect(clause?.source).toBe(filter);
    expect(clause?.predicate).toEqual({ sql: "region = ?", params: ["West"] });
  });

  it("binds an array as a list clause `column IN (?, …)`", () => {
    const filter = new Filter<string | string[]>(
      "region",
      listOptions,
      new FakeFilterUrlPort(""),
    );
    filter.value = ["West", "East"];
    expect(publishedPredicate(filter)).toEqual({
      sql: "region IN (?, ?)",
      params: ["West", "East"],
    });
  });

  it("replaces its own clause on a new value — one clause per source", () => {
    const filter = new Filter<string>(
      "region",
      { column: "region" },
      new FakeFilterUrlPort(""),
    );
    filter.value = "West";
    filter.value = "East";
    expect(filter.selection.clauses).toHaveLength(1);
    expect(publishedPredicate(filter)).toEqual({
      sql: "region = ?",
      params: ["East"],
    });
  });

  it("clears its clause when the value is cleared", () => {
    const filter = new Filter<string | string[]>(
      "region",
      listOptions,
      new FakeFilterUrlPort("?region=West"),
    );
    filter.value = undefined;
    expect(filter.selection.clauses).toHaveLength(0);
    const empty = new Filter<string | string[]>(
      "empty",
      listOptions,
      new FakeFilterUrlPort(""),
    );
    empty.value = [];
    expect(empty.selection.clauses).toHaveLength(0);
    const blank = new Filter<string>(
      "blank",
      { column: "blank" },
      new FakeFilterUrlPort(""),
    );
    blank.value = "";
    expect(blank.selection.clauses).toHaveLength(0);
  });

  it("publishes a setDefault seed — an authored default is a selection", () => {
    const filter = new Filter<string>(
      "region",
      { column: "region" },
      new FakeFilterUrlPort(""),
    );
    filter.setDefault("West");
    expect(publishedPredicate(filter)).toEqual({
      sql: "region = ?",
      params: ["West"],
    });
  });

  it("keeps the authored clause through a silent normalize — bounds collapse is a correction, not a selection", () => {
    const filter = new Filter<string>(
      "region",
      { column: "region" },
      new FakeFilterUrlPort(""),
    );
    filter.setDefault("West");
    filter.normalize("North");
    expect(filter.value).toBe("North");
    expect(publishedPredicate(filter)).toEqual({
      sql: "region = ?",
      params: ["West"],
    });
  });

  it("republishes a normalize that rewrites an existing URL param", () => {
    const filter = new Filter<string>(
      "region",
      { column: "region" },
      new FakeFilterUrlPort("?region=West"),
    );
    filter.normalize("North");
    expect(publishedPredicate(filter)).toEqual({
      sql: "region = ?",
      params: ["North"],
    });
  });

  it("does not re-publish an identical predicate — a same-content array write stays silent", () => {
    const filter = new Filter<string | string[]>(
      "region",
      listOptions,
      new FakeFilterUrlPort(""),
    );
    let updates = 0;
    filter.selection.subscribe(() => {
      updates += 1;
    });
    filter.value = ["West", "East"];
    filter.value = ["West", "East"];
    expect(updates).toBe(1);
    expect(filter.selection.clauses).toHaveLength(1);
  });
});

describe("Filter clause publication — per-input factory and column opt-out", () => {
  // The range inputs' shape — evidence's `SliderFilter.predicateSql` as a
  // clause factory.
  const rangeOptions: FilterOptions<number | [number, number]> = {
    column: "amount",
    clause: (column, value, context) =>
      clauseInterval(column, rangeExtent(value), context),
  };

  it("lets an input's clause factory replace the `=`/`IN` shape", () => {
    const filter = new Filter<number | [number, number]>(
      "amount",
      rangeOptions,
      new FakeFilterUrlPort(""),
    );
    filter.value = [10, 40];
    expect(publishedPredicate(filter)).toEqual({
      sql: "amount BETWEEN ? AND ?",
      params: [10, 40],
    });
    expect(filter.selection.clauses[0]?.meta).toEqual({ type: "interval" });
    filter.value = 10;
    expect(publishedPredicate(filter)).toEqual({
      sql: "amount >= ?",
      params: [10],
    });
  });

  it("contributes nothing when the factory emits a predicate-less clause", () => {
    const filter = new Filter<number | [number, number]>(
      "amount",
      {
        column: "amount",
        clause: (column, value, context) =>
          Array.isArray(value)
            ? clauseInterval(column, [value[0], value[1]], context)
            : clauseNoneLike(column, context),
      },
      new FakeFilterUrlPort(""),
    );
    filter.value = 10;
    expect(publishedPredicate(filter)).toBeUndefined();
  });

  it("contributes nothing for `column: false` even with a value", () => {
    const filter = new Filter<string>(
      "q",
      { column: false },
      new FakeFilterUrlPort(""),
    );
    filter.value = "north";
    expect(publishedPredicate(filter)).toBeUndefined();
  });

  it("republishes under a swapped factory on configure without writing the URL", () => {
    const port = new FakeFilterUrlPort("");
    const filter = new Filter<number | [number, number]>(
      "amount",
      { column: "amount" },
      port,
    );
    filter.value = 10;
    expect(publishedPredicate(filter)).toEqual({
      sql: "amount = ?",
      params: [10],
    });
    filter.configure(rangeOptions);
    expect(publishedPredicate(filter)).toEqual({
      sql: "amount >= ?",
      params: [10],
    });
    // Only the user interaction wrote — configure is silent.
    expect(port.written).toHaveLength(1);
  });
});

/** A predicate-less clause standing in for a factory's no-op branch. */
function clauseNoneLike(column: string, context: { source: object }) {
  return clausePoint(column, null, context);
}

/** The test range factory's extent — a number bounds-lo, a pair bounds both. */
function rangeExtent(
  value: number | [number, number] | undefined,
): IntervalExtent | null {
  if (typeof value === "number") return [value, undefined];
  if (Array.isArray(value) && value.length === 2) return [value[0], value[1]];
  return null;
}

describe("Filter.configure — late-arriving options", () => {
  it("is a no-op for undefined options", () => {
    const port = new FakeFilterUrlPort("?region=West");
    const filter = new Filter<string>("region", {}, port);
    filter.configure(undefined);
    expect(filter.value).toBe("West");
    expect(port.written).toHaveLength(0);
  });

  it("replaces the predicate column when one is provided", () => {
    const filter = new Filter<string>("region", {}, new FakeFilterUrlPort(""));
    filter.configure({ column: "sales_region" });
    filter.value = "West";
    expect(publishedPredicate(filter)).toEqual({
      sql: "sales_region = ?",
      params: ["West"],
    });
  });

  it("keeps the configured column when a later configure omits it", () => {
    const filter = new Filter<string>(
      "region",
      { column: "sales_region" },
      new FakeFilterUrlPort(""),
    );
    filter.configure({ deserialize: (raw) => raw });
    filter.value = "West";
    expect(publishedPredicate(filter)).toEqual({
      sql: "sales_region = ?",
      params: ["West"],
    });
  });

  it("re-decodes the live URL param when a deserialize arrives", () => {
    const port = new FakeFilterUrlPort('?channel=["a","b"]');
    // The column mirrors what a consumer's bare `Filters.ensure` sets.
    const filter = new Filter<string | string[]>(
      "channel",
      { column: "channel" },
      port,
    );
    expect(filter.value).toBe('["a","b"]');

    filter.configure({ deserialize: listOptions.deserialize });
    expect(filter.value).toEqual(["a", "b"]);
    expect(publishedPredicate(filter)).toEqual({
      sql: "channel IN (?, ?)",
      params: ["a", "b"],
    });
    expect(port.written).toHaveLength(0);
  });

  it("notifies subscribers when the re-decode changes the value", () => {
    const port = new FakeFilterUrlPort('?channel=["a","b"]');
    const filter = new Filter<string | string[]>("channel", {}, port);
    const seen: (string | string[] | undefined)[] = [];
    filter.subscribe(() => seen.push(filter.getSnapshot()));
    filter.configure({ deserialize: listOptions.deserialize });
    expect(seen).toEqual([["a", "b"]]);
  });

  it("does not touch the value when no param is present", () => {
    const port = new FakeFilterUrlPort("");
    const filter = new Filter<string | string[]>("channel", {}, port);
    filter.setDefault(["x"]);
    filter.configure({ deserialize: listOptions.deserialize });
    expect(filter.value).toEqual(["x"]);
  });

  it("seeds initialValue via setDefault only when unset", () => {
    const empty = new Filter<string>("region", {}, new FakeFilterUrlPort(""));
    empty.configure({ initialValue: "West" });
    expect(empty.value).toBe("West");

    const held = new Filter<string>(
      "region",
      {},
      new FakeFilterUrlPort("?region=East"),
    );
    held.configure({ initialValue: "West" });
    expect(held.value).toBe("East");
  });

  it("does not resurrect a cleared value via initialValue", () => {
    const filter = new Filter<string>(
      "region",
      {},
      new FakeFilterUrlPort("?region=West"),
    );
    filter.value = "";
    filter.configure({ initialValue: "East" });
    expect(filter.value).toBe("");
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

describe("Filter.registerClient — own-client cross-skip registration", () => {
  it("names the registered client on clauses published after registration", () => {
    const filter = new Filter<string>(
      "region",
      { column: "region" },
      new FakeFilterUrlPort(""),
    );
    filter.registerClient(stubClient);
    filter.value = "West";
    expect(filter.selection.clauses[0]?.clients?.has(stubClient)).toBe(true);
  });

  it("applies to an already-published clause — the clients set is live", () => {
    const filter = new Filter<string>(
      "region",
      { column: "region" },
      new FakeFilterUrlPort("?region=West"),
    );
    filter.registerClient(stubClient);
    expect(filter.selection.clauses[0]?.clients?.has(stubClient)).toBe(true);
  });

  it("unregisters through the returned cleanup", () => {
    const filter = new Filter<string>(
      "region",
      { column: "region" },
      new FakeFilterUrlPort("?region=West"),
    );
    const unregister = filter.registerClient(stubClient);
    unregister();
    expect(filter.selection.clauses[0]?.clients?.has(stubClient)).toBe(false);
  });
});

/** Moves the fake port's URL as an in-app navigation would, then reports how many writes the port saw before. */
function navigateTo(port: FakeFilterUrlPort, search: string): number {
  const writesBefore = port.written.length;
  port.write(new URL(`http://biac.test/${search}`));
  return writesBefore + 1;
}

describe("Filter.syncFromUrl — in-app navigation to the open page", () => {
  it("adopts a param the URL gained, without writing the URL", () => {
    const port = new FakeFilterUrlPort("");
    const filter = new Filter<string>("island", { column: "island" }, port);
    const writes = navigateTo(port, "?island=Dream");

    filter.syncFromUrl();

    expect(filter.value).toBe("Dream");
    expect(port.written).toHaveLength(writes);
    expect(publishedPredicate(filter)?.params).toEqual(["Dream"]);
  });

  it("falls back to initialValue when the URL lost the param", () => {
    const port = new FakeFilterUrlPort("?island=Dream");
    const filter = new Filter<string>(
      "island",
      { initialValue: "Biscoe" },
      port,
    );
    navigateTo(port, "");

    filter.syncFromUrl();

    expect(filter.value).toBe("Biscoe");
  });

  it("clears when the URL lost the param and there is no initialValue", () => {
    const port = new FakeFilterUrlPort("?island=Dream");
    const filter = new Filter<string>("island", { column: "island" }, port);
    navigateTo(port, "");

    filter.syncFromUrl();

    expect(filter.value).toBeUndefined();
    expect(publishedPredicate(filter)).toBeUndefined();
  });

  it("stays quiet when the URL already matches the held value", () => {
    const port = new FakeFilterUrlPort("?island=Dream");
    const filter = new Filter<string>("island", {}, port);
    let notified = 0;
    filter.subscribe(() => notified++);

    filter.syncFromUrl();

    expect(notified).toBe(0);
  });
});
