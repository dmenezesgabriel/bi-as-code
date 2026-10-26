import { describe, expect, it } from "vitest";
import { resolvePageChrome } from "./page-chrome";

const pages = [
  { route: "/" },
  { route: "/embed", sidebar: false, header: false },
  { route: "/no-header", header: false },
];

describe("resolvePageChrome", () => {
  it("uses the project's chrome for a page that sets no switch", () => {
    expect(resolvePageChrome(pages, "/", true)).toEqual({
      sidebar: true,
      header: true,
    });
  });

  it("lets each switch a page sets win over the project", () => {
    expect(resolvePageChrome(pages, "/no-header", true)).toEqual({
      sidebar: true,
      header: false,
    });
  });

  it("matches a page at its route's directory URL", () => {
    expect(resolvePageChrome(pages, "/embed/", true)).toEqual({
      sidebar: false,
      header: false,
    });
  });

  it("lets a page bring chrome back over nav.sidebar: false", () => {
    const restoring = [{ route: "/full", sidebar: true }];

    const chrome = resolvePageChrome(restoring, "/full", false);

    expect(chrome).toEqual({ sidebar: true, header: false });
  });

  it("keeps the project's chrome on a path no page serves", () => {
    expect(resolvePageChrome(pages, "/missing", true)).toEqual({
      sidebar: true,
      header: true,
    });
  });
});
