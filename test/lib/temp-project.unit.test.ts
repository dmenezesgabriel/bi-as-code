import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFiles,
} from "./temp-project.js";

afterEach(cleanupProjects);

describe("writeProjectFiles", () => {
  it("writes every entry under the root, creating parent directories", () => {
    // Arrange
    const root = makeTempProject();

    // Act
    writeProjectFiles(root, {
      "pages/index.md": "# Home\n",
      "data/nested/orders.csv": "id\n1\n",
    });

    // Assert
    expect(readFileSync(join(root, "pages/index.md"), "utf8")).toBe("# Home\n");
    expect(readFileSync(join(root, "data/nested/orders.csv"), "utf8")).toBe(
      "id\n1\n",
    );
  });
});
