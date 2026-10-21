import { describe, expect, it } from "vitest";
import { hotStoreSource } from "./hot-store-source.js";

interface CounterModule {
  readCount(): number;
  subscribeCount(listener: () => void): () => void;
}

async function importStore(count: number): Promise<CounterModule> {
  const source = [
    ...hotStoreSource({ count }, "subscribeCount"),
    "export function readCount() { return store.count; }",
  ].join("\n");
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

describe("hotStoreSource", () => {
  it("holds the given state for the module's own exports to read", async () => {
    const module = await importStore(3);

    expect(module.readCount()).toBe(3);
  });

  it("exports a subscribe under the given name that returns its unsubscribe", async () => {
    const module = await importStore(1);

    const unsubscribe = module.subscribeCount(() => {});

    expect(() => unsubscribe()).not.toThrow();
  });
});
