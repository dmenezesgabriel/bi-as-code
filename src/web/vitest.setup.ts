import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

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

  installThemeTokens(document);
}

/**
 * The font stacks Tailwind's `@import` defines as `--font-sans`, `--font-serif`
 * and `--font-mono`, read from its published `theme.css`. `styles.css` points
 * the brand font tokens at them (`--body-font: var(--font-stack-sans-serif)`
 * and so on); jsdom 31 substitutes `var()` and a reference to an undefined
 * property leaves the token empty, where jsdom 30 returned the literal text.
 */
function tailwindFontStacks(): string {
  const theme = readFileSync(
    createRequire(import.meta.url).resolve("tailwindcss/theme.css"),
    "utf8",
  );
  const stacks = theme.match(/--font-(?:sans|serif|mono):[^;]+;/g) ?? [];
  return `:root { ${stacks.join(" ").replace(/\s+/g, " ")} }`;
}

/**
 * Loads the app stylesheet into the test document, as `main.tsx` does in the
 * browser, so charts read their colours from the real theme tokens. The
 * Tailwind `@import` is dropped: jsdom cannot resolve a package specifier
 * and the tests need only the custom properties, plus the font stacks the
 * import would have defined.
 */
function installThemeTokens(doc: Document): void {
  // Vitest stubs every `.css` import, `?raw` included, to an empty string.
  const css = readFileSync(join(import.meta.dirname, "src/styles.css"), "utf8");
  const style = doc.createElement("style");
  style.textContent = `${tailwindFontStacks()}\n${css.replace(/^@import .*;$/m, "")}`;
  doc.head.append(style);
}
