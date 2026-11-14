import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { builtProject, fakePreviewServer } from "./fake-preview.js";
import { cleanupProjects } from "./temp-project.js";

afterEach(cleanupProjects);

describe("fakePreviewServer", () => {
  it("closes and prints urls without a real vite server", async () => {
    // Arrange
    const server = fakePreviewServer();

    // Act
    await server.close();
    server.printUrls();

    // Assert
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(server.printUrls).toHaveBeenCalledTimes(1);
  });
});

describe("builtProject", () => {
  it("makes a project root holding an empty build directory", () => {
    // Act
    const root = builtProject("biac-fake-");

    // Assert
    expect(existsSync(join(root, "build"))).toBe(true);
    expect(root).toContain("biac-fake-");
  });
});
