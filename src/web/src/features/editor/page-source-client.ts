import type { PageSourcePort } from "./types";

type FetchPageSource = (url: string, init?: RequestInit) => Promise<Response>;

// The dev server mounts its page-source middleware here and resolves the
// rest of the path under pages/ (src/engine/pages-plugin.ts).
const ENDPOINT = "/__biac/page-source/";
const PAGES_PREFIX = "pages/";

/**
 * The browser side of the dev page-source endpoint: reads a page's bytes
 * and replaces them with a JSON `PUT`, the only body shape the endpoint
 * accepts (it forces a CORS preflight). `fetchPageSource` is injected so
 * tests never reach a server.
 *
 * @example
 * const port = pageSourceClient(window.fetch.bind(window));
 * await port.save("pages/weekly-review.md", source);
 */
export function pageSourceClient(
  fetchPageSource: FetchPageSource,
): PageSourcePort {
  return {
    async read(file) {
      const response = await fetchPageSource(endpointUrl(file));
      assertOk(response, "Reading", file);
      return response.text();
    },
    async save(file, source) {
      const response = await fetchPageSource(endpointUrl(file), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      assertOk(response, "Saving", file);
    },
  };
}

function endpointUrl(file: string): string {
  if (!file.startsWith(PAGES_PREFIX)) {
    throw new Error(
      `Page source file "${file}" is outside pages/ (expected "pages/<path>.md")`,
    );
  }
  const segments = file.slice(PAGES_PREFIX.length).split("/");
  return ENDPOINT + segments.map(encodeURIComponent).join("/");
}

function assertOk(response: Response, verb: string, file: string): void {
  if (response.ok) return;
  throw new Error(`${verb} "${file}" failed: HTTP ${response.status}`);
}
