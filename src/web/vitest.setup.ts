import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest runs with globals disabled, so Testing Library's auto-cleanup
// (which hooks a global afterEach) never registers — renders would
// accumulate in document.body across tests.
afterEach(cleanup);

// jsdom lacks layout APIs several rendering paths expect (matchMedia,
// ResizeObserver); polyfilled here for web-unit tests running in jsdom.
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }

  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      readonly root = null;
      readonly rootMargin = "0px";
      readonly scrollMargin = "0px";
      readonly thresholds = [0];
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    };
  }

  // jsdom defines getContext but reports "Not implemented" through its
  // virtual console on every call — output no test reporter intercepts.
  // Returning null is what the HTML specification requires of a context
  // type the canvas cannot provide, and what canvas renderers fall back
  // from.
  window.HTMLCanvasElement.prototype.getContext = (): null => null;

  // The router scrolls on navigation; jsdom only prints "Not implemented"
  // warnings. Stub it like the layout APIs above.
  window.scrollTo = () => undefined;
}
