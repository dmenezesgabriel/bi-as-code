// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { interpolateQuery } from "./interpolate";

const DOCS_ROOT = path.join(import.meta.dirname, "../../../../../docs");
const PAGE = readFileSync(
  path.join(DOCS_ROOT, "pages/sql/translations.md"),
  "utf-8",
);
const FILE = readFileSync(path.join(DOCS_ROOT, "translations.yaml"), "utf-8");

/** The one key `fr` leaves out, so a French reader sees the `en` text. */
const FALLBACK_KEY = "fallback_note";

describe("the Translations reference", () => {
  it("shows docs/translations.yaml exactly as it is on disk", () => {
    // Arrange — the file without its leading comment, which the page words itself.
    const shown = FILE.slice(FILE.indexOf("\nen:") + 1).trimEnd();

    // Act
    const quoted = PAGE.includes(shown);

    // Assert — a retyped file would show a reader text the live examples never read.
    expect(quoted).toBe(true);
  });

  it("leaves the fallback key out of fr and keeps it in en", () => {
    // Arrange
    const [en, fr] = FILE.split("\nfr:");

    // Act
    const inEn = en!.includes(`${FALLBACK_KEY}:`);
    const inFr = fr!.includes(`${FALLBACK_KEY}:`);

    // Assert — the page promises French readers see this key in English.
    expect(inEn).toBe(true);
    expect(inFr).toBe(false);
  });

  it("reads only keys that docs/translations.yaml declares", () => {
    // Arrange
    // Only the fences the page runs: prose and quoted errors name keys on purpose.
    const live = [...PAGE.matchAll(/```(?:mdx|sql)[^\n]*\n([\s\S]*?)```/g)]
      .map((fence) => fence[1])
      .join("\n");
    const read = [...live.matchAll(/\$translations\.([a-z_.]+)/g)].map(
      (match) => match[1]!,
    );
    const declared = (key: string): boolean =>
      key.split(".").every((part) => FILE.includes(`${part}:`));

    // Act
    const unknown = read.filter((key) => !declared(key));

    // Assert — an undeclared literal key fails the page's compile.
    expect(read.length).toBeGreaterThan(0);
    expect(unknown).toEqual([]);
  });

  it("quotes the message a sql fence shows for a key that is not text", () => {
    // Arrange
    const sql = "select {{$translations.nope}}";

    // Act
    const [message] = interpolateQuery(sql, {
      params: {},
      queries: {},
      translations: {},
    }).errors;

    // Assert — a paraphrased message would send a reader to search for text biac never prints.
    expect(PAGE).toContain(message);
  });
});
