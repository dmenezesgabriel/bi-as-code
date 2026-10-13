import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { makePagesServer } from "../lib/pages-vite-server.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../lib/temp-project.js";
import { committedConfigHash, tempDirCount } from "../lib/vite-dep-cache.js";

afterEach(() => {
  cleanupProjects();
});

describe("an in-process pages test server", () => {
  it("leaves the shared dep cache as biac dev wrote it", async () => {
    // Arrange
    const tempDirsBefore = tempDirCount();
    const hashBefore = committedConfigHash();
    const root = makeTempProject("biac-pages-cache-");
    writeProjectFile(root, "pages/index.md", "# Hi\n");

    // Act
    const dev = await makePagesServer(root);
    await dev.transformRequest(`/@fs${join(root, "pages/index.md")}`);
    await dev.close();

    // Assert
    expect(tempDirCount()).toBe(tempDirsBefore);
    expect(committedConfigHash()).toBe(hashBefore);
  });
});
