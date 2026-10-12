import type { Filter } from "./filter";

interface Enlistment {
  /** Inputs currently enlisting this filter — two inputs may share an id. */
  holders: number;
  unfollow(): void;
}

/**
 * The filters whose inputs sit inside one container, and how many of them
 * are applied — what a container that hides its inputs needs to show that
 * they still narrow the page. `subscribe`/`getSnapshot` pair with
 * `useSyncExternalStore`, as `Filter`'s do.
 *
 * @example
 * const roster = new FilterRoster();
 * const leave = roster.enlist(filters.ensure("region"));
 * roster.getSnapshot(); // 1 when the URL has ?region=West
 */
export class FilterRoster {
  // `Filter<never>`: members of any value type are held alike, and the
  // roster only ever reads their values.
  readonly #members = new Map<Filter<never>, Enlistment>();
  readonly #listeners = new Set<() => void>();

  /** Adds `filter` to the roster; the returned function takes it out again. */
  enlist<Value>(filter: Filter<Value>): () => void {
    const member = filter as Filter<never>;
    const enlistment = this.#members.get(member) ?? this.#follow(member);
    enlistment.holders += 1;
    this.#notify();
    return () => this.#release(member, enlistment);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** The number of enlisted filters that are applied. */
  getSnapshot = (): number => {
    let applied = 0;
    for (const member of this.#members.keys()) {
      if (member.isApplied) applied += 1;
    }
    return applied;
  };

  #follow(member: Filter<never>): Enlistment {
    const enlistment: Enlistment = {
      holders: 0,
      unfollow: member.subscribe(this.#notify),
    };
    this.#members.set(member, enlistment);
    return enlistment;
  }

  #release(member: Filter<never>, enlistment: Enlistment) {
    enlistment.holders -= 1;
    if (enlistment.holders > 0) return;
    enlistment.unfollow();
    this.#members.delete(member);
    this.#notify();
  }

  #notify = () => {
    for (const listener of this.#listeners) listener();
  };
}
