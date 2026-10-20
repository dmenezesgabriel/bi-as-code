import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  parseTranslations,
  readTranslationsFile,
} from "./translations-file.js";

const FILE = "/site/translations.yaml";

function parseError(source: string): Error & { id?: string; loc?: object } {
  try {
    parseTranslations(source, FILE);
  } catch (error) {
    return error as Error;
  }
  throw new Error(`expected ${JSON.stringify(source)} to fail`);
}

describe("parseTranslations — accepted files", () => {
  it("keeps each language's keys, in file order", () => {
    const source = "fr:\n  revenue: Revenu\nen:\n  revenue: Revenue\n";

    const translations = parseTranslations(source, FILE);

    expect(Object.keys(translations)).toEqual(["fr", "en"]);
    expect(translations.fr).toEqual({ revenue: "Revenu" });
  });

  it("keeps nested maps and turns numbers and booleans into strings", () => {
    const source = "en:\n  kpi:\n    target: 42\n    live: true\n";

    expect(parseTranslations(source, FILE)).toEqual({
      en: { kpi: { target: "42", live: "true" } },
    });
  });

  it("reads an empty file as no languages", () => {
    expect(parseTranslations("", FILE)).toEqual({});
  });
});

describe("parseTranslations — located errors", () => {
  it("names the line and column of malformed YAML", () => {
    const error = parseError("en:\n  a: 1\n b: 2\n");

    expect(error.message).toMatch(/^Invalid translations\.yaml:3:\d+ — /);
    expect(error.id).toBe(FILE);
    expect(error.loc).toMatchObject({ file: FILE, line: 3 });
  });

  it("rejects a top-level key that is not an ISO 639-1 code", () => {
    const error = parseError("en:\n  a: A\nzz:\n  a: Z\n");

    expect(error.message).toBe(
      'Invalid translations.yaml:3:1 — "zz" is not an ISO 639-1 language code (expected two letters such as en or fr)',
    );
  });

  it("rejects a value that is neither text nor a nested map", () => {
    const error = parseError("en:\n  regions:\n    - West\n");

    expect(error.message).toBe(
      "Invalid translations.yaml:3:5 — en.regions must be a string, number, boolean or nested map, got a list",
    );
  });

  it("rejects a key with no value", () => {
    const error = parseError("en:\n  revenue:\n");

    expect(error.message).toMatch(
      /^Invalid translations\.yaml:2:\d+ — en\.revenue must be a string, number, boolean or nested map, got null$/,
    );
  });

  it("rejects a file that is not a map of languages", () => {
    const error = parseError("- en\n");

    expect(error.message).toBe(
      "Invalid translations.yaml:1:1 — the file must map language codes to translations, got a list",
    );
  });
});

describe("readTranslationsFile", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "biac-translations-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reads translations.yaml at the project root", () => {
    writeFileSync(join(root, "translations.yaml"), "en:\n  a: A\n");

    expect(readTranslationsFile(root)).toEqual({ en: { a: "A" } });
  });

  it("reads a project without the file as no languages", () => {
    expect(readTranslationsFile(root)).toEqual({});
  });
});
