import "@testing-library/jest-dom/vitest";

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

  // jsdom defines getContext but reports "Not implemented" through its
  // virtual console on every call — output no test reporter intercepts.
  // Returning null is what the HTML specification requires of a context
  // type the canvas cannot provide, and what canvas renderers fall back
  // from.
  window.HTMLCanvasElement.prototype.getContext = (): null => null;
}
