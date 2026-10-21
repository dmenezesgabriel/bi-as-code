import type { ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import type { SearchDocument } from "../../src/engine/types.js";
import { makePagesServer } from "../lib/pages-vite-server.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../lib/temp-project.js";

const VIRTUAL_SEARCH_ID = "virtual:biac-search";

let server: ViteDevServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
  cleanupProjects();
});

async function servedDocuments(
  files: Record<string, string>,
): Promise<SearchDocument[]> {
  const root = makeTempProject();
  for (const [path, content] of Object.entries(files)) {
    writeProjectFile(root, path, content);
  }
  server = await makePagesServer(root);
  const code = (await server.transformRequest(VIRTUAL_SEARCH_ID))?.code ?? "";
  const json = /export const documents = (.*);/.exec(code)?.[1];
  if (json === undefined) {
    throw new Error(`Expected "export const documents = [...]", got ${code}`);
  }
  return JSON.parse(json) as SearchDocument[];
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

  it("indexes translated text in the first declared language", async () => {
    const documents = await servedDocuments({
      "translations.yaml": "en:\n  title: Weekly\nfr:\n  title: Hebdomadaire\n",
      "pages/a.md": "# {$translations.title}\n",
    });

    expect(documents[0]?.text).toBe("Weekly");
  });

  it("serves the other pages' text when translations.yaml is broken", async () => {
    const documents = await servedDocuments({
      "translations.yaml": "en: [\n",
      "pages/a.md": "Plain words {$translations.title}\n",
    });

    expect(documents[0]?.text).toBe("Plain words");
  });
});
