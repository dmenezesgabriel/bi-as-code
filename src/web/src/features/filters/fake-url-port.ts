import type { FilterUrlPort } from "./filter-url-port";

/**
 * In-memory `FilterUrlPort` for tests: seeds a search string, serves a fresh
 * URL copy per `read()` (the real port reads `window.location.href` the same
 * way), and records every `write()` for assertions.
 */
export class FakeFilterUrlPort implements FilterUrlPort {
  #url: URL | undefined;
  readonly written: URL[] = [];

  /** `search` is the query string ("?region=West"); `undefined` = no URL. */
  constructor(search?: string) {
    this.#url =
      search === undefined ? undefined : new URL(`http://biac.test/${search}`);
  }

  read(): URL | undefined {
    return this.#url ? new URL(this.#url) : undefined;
  }

  write(url: URL): void {
    this.#url = new URL(url);
    this.written.push(new URL(url));
  }
}
