import { describe, expect, it } from "vitest";
import { AsyncDispatch } from "./async-dispatch";

/** A delivery recorder whose every delivery stays pending until released. */
class HeldDeliveries<T> {
  readonly delivered: T[] = [];
  readonly #release: Array<(ok: boolean) => void> = [];

  readonly deliver = (value: T): Promise<unknown> => {
    this.delivered.push(value);
    return new Promise((resolve, reject) =>
      this.#release.push((ok) => (ok ? resolve(undefined) : reject(value))),
    );
  };

  /** Settle the oldest held delivery, then let its continuation run. */
  async settle(ok = true): Promise<void> {
    this.#release.shift()?.(ok);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

describe("AsyncDispatch", () => {
  describe("idle", () => {
    it("delivers an emit synchronously", () => {
      const held = new HeldDeliveries<string>();
      const dispatch = new AsyncDispatch(held.deliver);

      dispatch.emit("a");

      expect(held.delivered).toEqual(["a"]);
    });

    it("stays idle after a delivery that returns no promise", () => {
      const delivered: string[] = [];
      const dispatch = new AsyncDispatch((value: string) => {
        delivered.push(value);
        return undefined;
      });

      dispatch.emit("a");
      dispatch.emit("b");

      expect(delivered).toEqual(["a", "b"]);
    });
  });

  describe("while a delivery is pending", () => {
    it("delivers only the latest queued emit once it settles", async () => {
      const held = new HeldDeliveries<string>();
      const dispatch = new AsyncDispatch(held.deliver);
      dispatch.emit("a");

      dispatch.emit("b");
      dispatch.emit("c");
      expect(held.delivered).toEqual(["a"]);
      await held.settle();

      expect(held.delivered).toEqual(["a", "c"]);
    });

    it("keeps the queued emits a keep filter accepts, in order", async () => {
      const held = new HeldDeliveries<string>();
      const dispatch = new AsyncDispatch(held.deliver);
      const sameLetter = (next: string) => (queued: string) =>
        queued[0] !== next[0];
      dispatch.emit("a1");

      dispatch.emit("b1", sameLetter("b1"));
      dispatch.emit("c1", sameLetter("c1"));
      dispatch.emit("b2", sameLetter("b2"));
      await held.settle();
      await held.settle();

      expect(held.delivered).toEqual(["a1", "c1", "b2"]);
    });

    it("releases the queue when a delivery rejects", async () => {
      const held = new HeldDeliveries<string>();
      const dispatch = new AsyncDispatch(held.deliver);
      dispatch.emit("a");
      dispatch.emit("b");

      await held.settle(false);

      expect(held.delivered).toEqual(["a", "b"]);
    });
  });

  describe("after the queue drains", () => {
    it("delivers the next emit synchronously again", async () => {
      const held = new HeldDeliveries<string>();
      const dispatch = new AsyncDispatch(held.deliver);
      dispatch.emit("a");
      await held.settle();

      dispatch.emit("b");

      expect(held.delivered).toEqual(["a", "b"]);
    });
  });
});
