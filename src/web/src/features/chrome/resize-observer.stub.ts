import { vi } from "vitest";

/**
 * A controllable `ResizeObserver` stub for web-unit tests: jsdom lays
 * nothing out, so the inert vitest.setup polyfill never reports a box. The
 * stub records each live observer and lets a test announce a resize by
 * firing every live callback — consumers read the element's own box
 * (`offsetHeight`) rather than the entry payload, so entries stay empty.
 * Restore with `vi.unstubAllGlobals()`.
 *
 * @example
 * const ro = stubResizeObserver();
 * render(<FilterBar>…</FilterBar>);
 * act(() => ro.fire());
 */
export function stubResizeObserver() {
  const live = new Set<ResizeObserverCallback>();

  class StubResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(): void {
      live.add(this.callback);
    }
    unobserve(): void {
      live.delete(this.callback);
    }
    disconnect(): void {
      live.delete(this.callback);
    }
  }

  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  return {
    /** Invokes every live observer's callback with an empty entry list. */
    fire(): void {
      for (const callback of live) callback([], {} as ResizeObserver);
    },
    liveCount: (): number => live.size,
  };
}
