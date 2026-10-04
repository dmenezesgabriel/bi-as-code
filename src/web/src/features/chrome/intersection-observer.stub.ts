import { vi } from "vitest";

interface LiveObserver {
  callback: IntersectionObserverCallback;
  targets: Set<Element>;
  dead: boolean;
}

/**
 * A controllable `IntersectionObserver` stub for web-unit tests: jsdom has
 * no IO at all, and the ToC scroll-spy's callback ignores entry payloads —
 * so the stub records each live observer and lets tests retrigger a
 * recompute by firing every live callback at once. Restore with
 * `vi.unstubAllGlobals()`.
 */
export function stubIntersectionObserver() {
  const live: LiveObserver[] = [];

  class StubIntersectionObserver {
    private entry: LiveObserver;
    constructor(callback: IntersectionObserverCallback) {
      this.entry = { callback, targets: new Set(), dead: false };
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
    /** Invokes every live observer's callback with an empty entry list. */
    fire() {
      for (const observer of live) {
        if (!observer.dead) {
          observer.callback([], observer as unknown as IntersectionObserver);
        }
      }
    },
    liveCount: () => live.filter((o) => !o.dead).length,
    observedCount: () =>
      live.filter((o) => !o.dead).reduce((n, o) => n + o.targets.size, 0),
  };
}
