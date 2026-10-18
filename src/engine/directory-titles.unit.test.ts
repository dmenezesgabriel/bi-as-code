import { describe, expect, it } from "vitest";
import { ConfigFieldError } from "./biac-config-error.js";
import { checkDirectoryTitles } from "./directory-titles.js";
import type { PageManifestEntry } from "./types.js";

function page(file: string): PageManifestEntry {
  return { route: `/${file.slice("pages/".length, -3)}`, file, isIndex: false };
}

const PAGES = [
  page("pages/index.md"),
  page("pages/nested/page.md"),
  page("pages/reports/q1/summary.md"),
];

describe("checkDirectoryTitles", () => {
  it("accepts titles for folders that hold a page, at any depth", () => {
    const titles = {
      "pages/nested": { title: "Planning" },
      "pages/reports": { title: "Reports" },
    };

    expect(() => checkDirectoryTitles(titles, PAGES)).not.toThrow();
  });

  it("names a stale key, the folders that hold pages and the closest one", () => {
    const titles = { "pages/nestd": { title: "Planning" } };

    const check = () => checkDirectoryTitles(titles, PAGES);

    expect(check).toThrow(ConfigFieldError);
    expect(check).toThrow(
      "directories.pages/nestd: unknown key, expected one of pages/nested, pages/reports (did you mean pages/nested?)",
    );
  });

  it("locates the error at the stale key", () => {
    const titles = { "pages/gone": { title: "Gone" } };

    const error = captureError(() => checkDirectoryTitles(titles, PAGES));

    expect(error.keyPath).toEqual(["directories", "pages/gone"]);
  });
});

function captureError(run: () => void): ConfigFieldError {
  try {
    run();
  } catch (error) {
    if (error instanceof ConfigFieldError) return error;
  }
  throw new Error("expected checkDirectoryTitles to throw a ConfigFieldError");
}
