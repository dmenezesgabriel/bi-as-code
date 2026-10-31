import { vi } from "vitest";

interface LiveObserver {
  callback: IntersectionObserverCallback;
  targets: Set<Element>;
  options: IntersectionObserverInit | undefined;
  dead: boolean;
}

/**
 * A controllable `IntersectionObserver` stub for web-unit tests: jsdom has
 * no IO at all, and the ToC scroll-spy's callback ignores entry payloads —
 * so the stub records each live observer and lets tests retrigger a
 * recompute by firing every live callback at once. `fire()` with no
 * argument passes an empty entry list; `fire(bool)` fabricates one entry
 * per observed target carrying the flag, for consumers that read
 * `entries[0].isIntersecting` (the FilterBar sentinel). Restore with
 * `vi.unstubAllGlobals()`.
 */
export function stubIntersectionObserver() {
  const live: LiveObserver[] = [];

  class StubIntersectionObserver {
    private entry: LiveObserver;
    constructor(
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit,
    ) {
      this.entry = { callback, targets: new Set(), options, dead: false };
      live.push(this.entry);
    }
    observe(target: Element) {
      this.entry.targets.add(target);
    }
    unobserve(target: Element) {
      this.entry.targets.delete(target);
    }
    disconnect() {
      this.entry.dead = true;
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  vi.stubGlobal("IntersectionObserver", StubIntersectionObserver);
  return {
    /**
     * Invokes every live observer's callback — an empty entry list when no
     * flag is given, else one `{target, isIntersecting}` entry per target
     * the observer watches.
     */
    fire(isIntersecting?: boolean) {
      for (const observer of live) {
        if (observer.dead) continue;
        const entries =
          isIntersecting === undefined
            ? []
            : [...observer.targets].map(
                (target) =>
                  ({ target, isIntersecting }) as IntersectionObserverEntry,
              );
        observer.callback(entries, observer as unknown as IntersectionObserver);
      }
    },
    /** The `rootMargin` each live observer was created with. */
    rootMargins: () =>
      live.filter((o) => !o.dead).map((o) => o.options?.rootMargin),
    liveCount: () => live.filter((o) => !o.dead).length,
    observedCount: () =>
      live.filter((o) => !o.dead).reduce((n, o) => n + o.targets.size, 0),
  };
}
