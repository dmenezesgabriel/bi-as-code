import { describe, expect, it } from "vitest";
import { resolveTranslations } from "./resolve-translations.js";

describe("resolveTranslations", () => {
  it("lists the declared languages in file order", async () => {
    const resolved = await resolveTranslations({
      fr: { a: "A fr" },
      en: { a: "A en" },
    });

    expect(resolved.languages).toEqual(["fr", "en"]);
  });

  it("falls back to the en value for a key a language leaves out", async () => {
    const resolved = await resolveTranslations({
      en: { revenue: "Revenue", methodology: "Methodology" },
      fr: { revenue: "Revenu" },
    });

    expect(resolved.byLanguage.fr).toEqual({
      revenue: "Revenu",
      methodology: "Methodology",
    });
  });

  it("merges nested maps key by key", async () => {
    const resolved = await resolveTranslations({
      en: { kpi: { title: "KPIs", target: "Target" } },
      fr: { kpi: { title: "Indicateurs" } },
    });

    expect(resolved.byLanguage.fr).toEqual({
      kpi: { title: "Indicateurs", target: "Target" },
    });
  });

  it("expands $t() references to other keys of the same language", async () => {
    const resolved = await resolveTranslations({
      en: {
        brand: "Acme",
        title: "$t(brand) weekly",
        nested: { x: "$t(title)!" },
      },
    });

    expect(resolved.byLanguage.en).toEqual({
      brand: "Acme",
      title: "Acme weekly",
      nested: { x: "Acme weekly!" },
    });
  });

  it("does not leak the en fallback into a language without en", async () => {
    const resolved = await resolveTranslations({
      fr: { a: "A" },
      de: { b: "B" },
    });

    expect(resolved.byLanguage.de).toEqual({ b: "B" });
  });

  it("resolves no languages from an empty file", async () => {
    expect(await resolveTranslations({})).toEqual({
      languages: [],
      byLanguage: {},
    });
  });
});
