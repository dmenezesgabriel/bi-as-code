import { describe, expect, it } from "vitest";
import { translationsModuleSource } from "./translations-module.js";
import type { ResolvedTranslations } from "./types.js";

interface TranslationsModule {
  languages: string[];
  translationsFor(language?: string): unknown;
}

async function importModule(
  resolved: ResolvedTranslations,
): Promise<TranslationsModule> {
  const source = translationsModuleSource(resolved);
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

const RESOLVED: ResolvedTranslations = {
  languages: ["fr", "en"],
  byLanguage: { fr: { a: "A fr" }, en: { a: "A en" } },
};

describe("virtual:biac-translations", () => {
  it("exports the declared languages in file order", async () => {
    const translations = await importModule(RESOLVED);

    expect(translations.languages).toEqual(["fr", "en"]);
  });

  it("gives the asked language's map", async () => {
    const translations = await importModule(RESOLVED);

    expect(translations.translationsFor("en")).toEqual({ a: "A en" });
  });

  it("gives the first declared language's map with no language asked", async () => {
    const translations = await importModule(RESOLVED);

    expect(translations.translationsFor(undefined)).toEqual({ a: "A fr" });
  });

  it("gives the first declared language's map for an undeclared one", async () => {
    const translations = await importModule(RESOLVED);

    expect(translations.translationsFor("constructor")).toEqual({ a: "A fr" });
  });

  it("gives an empty map when no language is declared", async () => {
    const translations = await importModule({ languages: [], byLanguage: {} });

    expect(translations.translationsFor(undefined)).toEqual({});
  });
});
