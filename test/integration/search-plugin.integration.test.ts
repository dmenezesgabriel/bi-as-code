import { join } from "node:path";
import type { ViteDevServer } from "vite";
import { describe, expect, it } from "vitest";
import type {
  SearchDocument,
  SearchDocumentSets,
} from "../../src/engine/types.js";
import {
  registerDevServerLifecycle,
  serveProjectFiles,
} from "../lib/dev-server-suite.js";
import { expectInvalidated, waitForWatch } from "../lib/pages-vite-server.js";
import { writeProjectFile } from "../lib/temp-project.js";

registerDevServerLifecycle();

const VIRTUAL_SEARCH_ID = "virtual:biac-search";
const RESOLVED_SEARCH_ID = "\0virtual:biac-search";

async function servedSets(dev: ViteDevServer): Promise<SearchDocumentSets> {
  const code = (await dev.transformRequest(VIRTUAL_SEARCH_ID))?.code ?? "";
  const json = /Object\.assign\(store, (.*)\);/.exec(code)?.[1];
  if (json === undefined) {
    throw new Error(`Expected "Object.assign(store, {...});", got ${code}`);
  }
  return JSON.parse(json) as SearchDocumentSets;
}

/** The untranslated documents of a project without translations.yaml. */
async function servedDocuments(
  files: Record<string, string>,
): Promise<SearchDocument[]> {
  const { dev } = await serveProjectFiles(files);
  return (await servedSets(dev)).byLanguage[""] ?? [];
}

function searchModule(dev: ViteDevServer) {
  return dev.environments.client.moduleGraph.getModuleById(RESOLVED_SEARCH_ID);
}

describe("virtual:biac-search", () => {
  it("serves each page's route, sidebar name, prose and keywords", async () => {
    const documents = await servedDocuments({
      "pages/index.md":
        "---\ntitle: Overview\n---\n# Overview\n\nAll orders.\n",
      "pages/nested/allocation.md":
        "---\nkeywords: [margin]\n---\n# Allocation\n\n```sql q\nselect 1\n```\n",
    });

    expect(documents).toEqual([
      {
        id: "/",
        title: "Overview",
        text: "Overview All orders.",
        keywords: "",
      },
      {
        id: "/nested/allocation",
        title: "Allocation",
        text: "Allocation",
        keywords: "margin",
      },
    ]);
  });

  it("leaves out a page with index: false", async () => {
    const documents = await servedDocuments({
      "pages/a.md": "# A\n",
      "pages/hidden.md": "---\nindex: false\n---\n# Hidden\n",
    });

    expect(documents.map((document) => document.id)).toEqual(["/a"]);
  });

  it("serves each declared language's translated text", async () => {
    const { dev } = await serveProjectFiles({
      "translations.yaml": "en:\n  title: Weekly\nfr:\n  title: Hebdomadaire\n",
      "pages/a.md": "# {$translations.title}\n",
    });

    const sets = await servedSets(dev);

    expect(sets.languages).toEqual(["en", "fr"]);
    expect(sets.byLanguage.en?.[0]?.text).toBe("Weekly");
    expect(sets.byLanguage.fr?.[0]?.text).toBe("Hebdomadaire");
  });

  it("serves the other pages' text when translations.yaml is broken", async () => {
    const documents = await servedDocuments({
      "translations.yaml": "en: [\n",
      "pages/a.md": "Plain words {$translations.title}\n",
    });

    expect(documents[0]?.text).toBe("Plain words");
  });
});

describe("editing a page", () => {
  it("hot-updates the search module with a page's new keywords", async () => {
    const { root, dev } = await serveProjectFiles({ "pages/a.md": "# A\n" });
    await servedSets(dev);
    await waitForWatch(dev, join(root, "pages"), "a.md");

    await expectInvalidated(searchModule(dev), () =>
      writeProjectFile(root, "pages/a.md", "---\nkeywords: margin\n---\n# A\n"),
    );

    expect((await servedSets(dev)).byLanguage[""]?.[0]?.keywords).toBe(
      "margin",
    );
    expect(searchModule(dev)?.lastHMRTimestamp).toBeGreaterThan(0);
  });

  it("re-serves the search module with a page added", async () => {
    const { root, dev } = await serveProjectFiles({ "pages/a.md": "# A\n" });
    await servedSets(dev);
    await waitForWatch(dev, join(root, "pages"), "a.md");

    await expectInvalidated(searchModule(dev), () =>
      writeProjectFile(root, "pages/b.md", "# B\n"),
    );

    const ids = (await servedSets(dev)).byLanguage[""]?.map((doc) => doc.id);
    expect(ids).toEqual(["/a", "/b"]);
  });
});

describe("editing translations.yaml", () => {
  it("hot-updates the search module with the new text", async () => {
    const { root, dev } = await serveProjectFiles({
      "translations.yaml": "en:\n  title: Weekly\n",
      "pages/a.md": "# {$translations.title}\n",
    });
    await dev.transformRequest(`/@fs${join(root, "pages/a.md")}`);
    await servedSets(dev);
    await waitForWatch(dev, root, "translations.yaml");

    await expectInvalidated(searchModule(dev), () =>
      writeProjectFile(root, "translations.yaml", "en:\n  title: Monthly\n"),
    );

    expect((await servedSets(dev)).byLanguage.en?.[0]?.text).toBe("Monthly");
    expect(searchModule(dev)?.lastHMRTimestamp).toBeGreaterThan(0);
  });
});
