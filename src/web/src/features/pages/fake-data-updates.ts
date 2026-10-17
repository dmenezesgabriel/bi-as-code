import type { DataUpdate, DataUpdateSubscription } from "./types";

/**
 * In-memory stand-in for the dev server's data-update channel — tests
 * `emit` a change and read how many listeners are still subscribed.
 *
 * @example
 * const updates = new FakeDataUpdates();
 * render(<QueryRegistryProvider dataUpdates={updates.subscription} … />);
 * updates.emit({ path: "data/orders.csv", version: 2 });
 */
export class FakeDataUpdates {
  private readonly listeners = new Set<(update: DataUpdate) => void>();

  readonly subscription: DataUpdateSubscription = (onUpdate) => {
    this.listeners.add(onUpdate);
    return () => void this.listeners.delete(onUpdate);
  };

  get listenerCount(): number {
    return this.listeners.size;
  }

  emit(update: DataUpdate): void {
    for (const listener of this.listeners) listener(update);
  }
}
