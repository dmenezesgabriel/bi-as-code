/** Which queued values survive a new emit; `undefined` drops every one. */
export type QueueKeep<T> = (queued: T) => boolean;

/**
 * Latest-wins event dispatch, the port of mosaic's `AsyncDispatch`
 * (https://idl.uw.edu/mosaic/api/core/selection): an idle emit delivers
 * synchronously; a delivery that returns no promise leaves the dispatch
 * idle, and while a returned promise is pending, later emits
 * queue — each new one filtering the queue through `keep`, or replacing
 * it outright — and the next queued value delivers once it settles. So at
 * most one delivery is in flight, and a burst of emits costs one
 * delivery for the latest value instead of one per emit.
 *
 * @example
 * const dispatch = new AsyncDispatch((snapshot) => notifyAll(snapshot));
 * dispatch.emit(snapshot, (queued) => queued.source !== snapshot.source);
 */
export class AsyncDispatch<T> {
  readonly #deliver: (value: T) => Promise<unknown> | undefined;
  #pending = false;
  #queue: T[] = [];

  constructor(deliver: (value: T) => Promise<unknown> | undefined) {
    this.#deliver = deliver;
  }

  /**
   * Deliver `value` now when idle, else queue it behind the pending one.
   *
   * @example
   * dispatch.emit(value); // drops every queued value
   */
  emit(value: T, keep?: QueueKeep<T>): void {
    if (this.#pending) {
      this.#queue = keep ? [...this.#queue.filter(keep), value] : [value];
      return;
    }
    const delivery = this.#deliver(value);
    if (!delivery) return;
    this.#pending = true;
    void delivery.catch(() => {}).finally(() => this.#next());
  }

  #next(): void {
    this.#pending = false;
    if (this.#queue.length === 0) return;
    const [next, ...rest] = this.#queue as [T, ...T[]];
    this.#queue = rest;
    this.emit(next);
  }
}
