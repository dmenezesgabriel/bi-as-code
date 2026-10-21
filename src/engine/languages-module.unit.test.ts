import { describe, expect, it } from "vitest";
import { languagesModuleSource } from "./languages-module.js";

interface LanguagesModule {
  getLanguages(): string[];
  subscribeLanguages(listener: () => void): () => void;
}

async function importModule(languages: string[]): Promise<LanguagesModule> {
  const source = languagesModuleSource(languages);
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

describe("virtual:biac-languages", () => {
  it("gives the declared languages in file order", async () => {
    const module = await importModule(["fr", "en"]);

    expect(module.getLanguages()).toEqual(["fr", "en"]);
  });

  it("gives the same list on every read, as a store snapshot must", async () => {
    const module = await importModule(["en", "fr"]);

    expect(module.getLanguages()).toBe(module.getLanguages());
  });

  it("gives an empty list when none is declared", async () => {
    const module = await importModule([]);

    expect(module.getLanguages()).toEqual([]);
  });

  it("returns an unsubscribe for each listener", async () => {
    const module = await importModule(["en"]);

    const unsubscribe = module.subscribeLanguages(() => {});

    expect(unsubscribe).toBeTypeOf("function");
    expect(() => unsubscribe()).not.toThrow();
  });
});
