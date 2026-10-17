import { describe, expect, it } from "vitest";
import { hmrDataUpdates, type HotChannel } from "./data-updates";
import type { DataUpdate } from "./types";

type Listener = (payload: DataUpdate) => void;

/** Records `on`/`off` per event, as vite's HMR client keeps them. */
class FakeHotChannel implements HotChannel {
  readonly listeners = new Map<string, Set<Listener>>();
  on(event: string, listener: Listener): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }
  off(event: string, listener: Listener): void {
    this.listeners.get(event)?.delete(listener);
  }
  send(event: string, payload: DataUpdate): void {
    for (const listener of this.listeners.get(event) ?? []) listener(payload);
  }
}

describe("hmrDataUpdates", () => {
  it("delivers biac:data-update payloads until unsubscribed", () => {
    const hot = new FakeHotChannel();
    const seen: DataUpdate[] = [];
    const unsubscribe = hmrDataUpdates(hot)((update) => seen.push(update));

    hot.send("biac:data-update", { path: "data/a.csv", version: 1 });
    unsubscribe();
    hot.send("biac:data-update", { path: "data/a.csv", version: 2 });

    expect(seen).toEqual([{ path: "data/a.csv", version: 1 }]);
    expect(hot.listeners.get("biac:data-update")?.size).toBe(0);
  });

  it("ignores other HMR events", () => {
    const hot = new FakeHotChannel();
    const seen: DataUpdate[] = [];
    hmrDataUpdates(hot)((update) => seen.push(update));

    hot.send("vite:beforeUpdate", { path: "data/a.csv", version: 1 });

    expect(seen).toEqual([]);
  });
});
