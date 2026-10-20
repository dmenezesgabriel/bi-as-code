import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";
import {
  recmaBindTranslations,
  remarkCheckTranslationKeys,
} from "./page-translations.js";
import type { PageTranslationUse, ResolvedTranslations } from "./types.js";

const TRANSLATIONS: ResolvedTranslations = {
  languages: ["en", "fr"],
  byLanguage: {
    en: { revenue: "Revenue", kpi: { target: "Target" }, only_en: "x" },
    fr: { revenue: "Revenu", kpi: { target: "Cible" }, only_en: "x" },
  },
};

/** Counts how often the page compile asked for the translations. */
class FakeTranslationsLoader {
  loads = 0;

  constructor(private readonly translations: ResolvedTranslations) {}

  readonly load = async (): Promise<ResolvedTranslations> => {
    this.loads += 1;
    return this.translations;
  };
}

async function compilePageBody(
  markdown: string,
  loader = new FakeTranslationsLoader(TRANSLATIONS),
): Promise<{ code: string; use: PageTranslationUse }> {
  const use: PageTranslationUse = { reads: false };
  const compiled = await compile(markdown, {
    format: "mdx",
    remarkPlugins: [[remarkCheckTranslationKeys, loader.load, use]],
    recmaPlugins: [[recmaBindTranslations, use]],
  });
  return { code: String(compiled), use };
}

async function compileError(markdown: string): Promise<{
  message: string;
  line?: number;
  column?: number;
}> {
  try {
    await compilePageBody(markdown);
  } catch (error) {
    return error as { message: string; line?: number; column?: number };
  }
  throw new Error(`expected ${JSON.stringify(markdown)} to fail`);
}

describe("binding $translations in a page that reads it", () => {
  it("imports the resolved maps and binds the page's language", async () => {
    const { code, use } = await compilePageBody("# {$translations.revenue}\n");

    expect(use.reads).toBe(true);
    expect(code).toContain(
      'import {translationsFor as _translationsFor} from "virtual:biac-translations";',
    );
    expect(code).toMatch(
      /function _createMdxContent\(props\) \{\n\s+const \$translations = _translationsFor\(props\.language\);/,
    );
  });

  it("binds it for a key read in a tag attribute", async () => {
    const { use } = await compilePageBody(
      "<Value title={$translations.kpi.target} />\n",
    );

    expect(use.reads).toBe(true);
  });

  it("leaves a page without $translations untouched and unloaded", async () => {
    const loader = new FakeTranslationsLoader(TRANSLATIONS);

    const { code, use } = await compilePageBody("# Revenue\n", loader);

    expect(use.reads).toBe(false);
    expect(code).not.toContain("virtual:biac-translations");
    expect(loader.loads).toBe(0);
  });
});

describe("checking literal translation keys", () => {
  it("fails an unknown key at its position with the closest key", async () => {
    const error = await compileError("\n# {$translations.revenu}\n");

    expect(error.message).toBe(
      "Undefined translation key: $translations.revenu (did you mean $translations.revenue?)",
    );
    expect([error.line, error.column]).toEqual([2, 4]);
  });

  it("fails an unknown key in a tag attribute", async () => {
    const error = await compileError(
      "<Value title={$translations.kpi.targt} />\n",
    );

    expect(error.message).toBe(
      "Undefined translation key: $translations.kpi.targt (did you mean $translations.kpi.target?)",
    );
  });

  it("fails a key that names a nested map rather than its text", async () => {
    const error = await compileError("{$translations.kpi}\n");

    expect(error.message).toMatch(
      /^Undefined translation key: \$translations\.kpi/,
    );
  });

  it("fails a key one declared language cannot resolve", async () => {
    const loader = new FakeTranslationsLoader({
      languages: ["en", "fr"],
      byLanguage: { en: { a: "A" }, fr: { a: "A", fr_only: "F" } },
    });

    await expect(
      compilePageBody("{$translations.fr_only}\n", loader),
    ).rejects.toThrow("Undefined translation key: $translations.fr_only");
  });

  it("fails every key when the project has no translations", async () => {
    const loader = new FakeTranslationsLoader({
      languages: [],
      byLanguage: {},
    });

    await expect(
      compilePageBody("{$translations.revenue}\n", loader),
    ).rejects.toThrow(/^Undefined translation key: \$translations\.revenue$/);
  });

  it("does not check a key computed when the page runs", async () => {
    const { use } = await compilePageBody('{$translations["rev" + "enue"]}\n');

    expect(use.reads).toBe(true);
  });
});
