import { describe, expect, it } from "vitest";
import { pageProse, proseText } from "./page-search-text.js";
import type { TranslationMap } from "./types.js";

function pageSearchText(body: string, translations: TranslationMap): string {
  return proseText(pageProse(body), translations);
}

describe("pageProse + proseText — prose", () => {
  it("joins heading, paragraph and list text", () => {
    const markdown =
      "# Orders\n\nWeekly *volume* by region.\n\n- north\n- south\n";

    const text = pageSearchText(markdown, {});

    expect(text).toBe("Orders Weekly volume by region. north south");
  });

  it("keeps table cells and inline code", () => {
    const markdown = "Run `biac dev`.\n\n| a | b |\n| - | - |\n| one | two |\n";

    const text = pageSearchText(markdown, {});

    expect(text).toBe("Run biac dev . a b one two");
  });
});

describe("pageProse + proseText — skipped", () => {
  it("leaves code fences out", () => {
    const markdown = "Before\n\n```sql orders\nselect 1\n```\n\nAfter\n";

    expect(pageSearchText(markdown, {})).toBe("Before After");
  });

  it("leaves out a widget that reads data, children included", () => {
    const markdown = 'Intro\n\n<Table data="orders">\n  Inner\n</Table>\n';

    expect(pageSearchText(markdown, {})).toBe("Intro");
  });

  it("keeps the text inside a layout element", () => {
    const markdown = '<Callout type="info">\n  Read this\n</Callout>\n';

    expect(pageSearchText(markdown, {})).toBe("Read this");
  });

  it("leaves other expressions out", () => {
    expect(pageSearchText("Total {1 + 1} now\n", {})).toBe("Total now");
  });
});

describe("pageProse + proseText — translations", () => {
  it("resolves a translated heading to its text", () => {
    const translations = { title: "Revue hebdomadaire" };

    const text = pageSearchText("# {$translations.title}\n", translations);

    expect(text).toBe("Revue hebdomadaire");
  });

  it("resolves a nested key", () => {
    const translations = { sections: { trend: "Tendances" } };
    const markdown = "Read {$translations.sections.trend} here\n";

    const text = pageSearchText(markdown, translations);

    expect(text).toBe("Read Tendances here");
  });

  it("drops a key the translations lack", () => {
    expect(pageSearchText("# {$translations.missing}\n", {})).toBe("");
  });
});

describe("pageProse — one parse, many languages", () => {
  it("resolves the same parsed page in each language's translations", () => {
    const prose = pageProse("# {$translations.title}\n\nWeekly.\n");

    const english = proseText(prose, { title: "Weekly review" });
    const french = proseText(prose, { title: "Revue hebdomadaire" });

    expect([english, french]).toEqual([
      "Weekly review Weekly.",
      "Revue hebdomadaire Weekly.",
    ]);
  });
});
