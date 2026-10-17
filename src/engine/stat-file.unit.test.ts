import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../../test/lib/temp-project.js";
import { statFile } from "./stat-file.js";

afterEach(() => {
  cleanupProjects();
});

describe("statFile", () => {
  it("returns the stats of a regular file", () => {
    const root = makeTempProject("biac-stat-");
    writeProjectFile(root, "a.csv", "x\n1\n");

    expect(statFile(join(root, "a.csv"))?.size).toBe(4);
  });

  it("returns null for a missing entry", () => {
    const root = makeTempProject("biac-stat-");

    expect(statFile(join(root, "a.csv"))).toBeNull();
  });

  it("returns null for a directory", () => {
    const root = makeTempProject("biac-stat-");
    mkdirSync(join(root, "data"));

    expect(statFile(join(root, "data"))).toBeNull();
  });
});
