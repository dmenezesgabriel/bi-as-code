import { statSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../../test/lib/temp-project.js";
import { DEFAULT_INTERPRETERS } from "./data-loader-interpreters.js";
import { dataUpdateFor } from "./data-update.js";

afterEach(() => {
  cleanupProjects();
});

function projectWith(relativePath: string, content: string): string {
  const root = makeTempProject();
  writeProjectFile(root, relativePath, content);
  return root;
}

describe("dataUpdateFor — targets", () => {
  it("maps a static file to its own data path, versioned by mtime", () => {
    const root = projectWith("data/a.csv", "x\n1\n");
    const file = join(root, "data/a.csv");

    const update = dataUpdateFor(
      file,
      join(root, "data"),
      undefined,
      DEFAULT_INTERPRETERS,
    );

    expect(update).toEqual({
      path: "data/a.csv",
      version: statSync(file).mtimeMs,
    });
  });

  it("keeps a nested file's subdirectory in its path", () => {
    const root = projectWith("data/sub/a.csv", "x\n1\n");

    const update = dataUpdateFor(
      join(root, "data/sub/a.csv"),
      join(root, "data"),
      undefined,
      DEFAULT_INTERPRETERS,
    );

    expect(update?.path).toBe("data/sub/a.csv");
  });

  it("maps a loader source to the target it generates", () => {
    const root = projectWith("data/x.csv.js", "process.stdout.write('x');\n");

    const update = dataUpdateFor(
      join(root, "data/x.csv.js"),
      join(root, "data"),
      undefined,
      DEFAULT_INTERPRETERS,
    );

    expect(update?.path).toBe("data/x.csv");
  });

  it("maps a loader in another language to the target it generates", () => {
    const root = projectWith("data/x.csv.py", 'print("x")\n');

    const update = dataUpdateFor(
      join(root, "data/x.csv.py"),
      join(root, "data"),
      undefined,
      DEFAULT_INTERPRETERS,
    );

    expect(update?.path).toBe("data/x.csv");
  });
});

describe("dataUpdateFor — ignored changes", () => {
  it("ignores a file outside data/", () => {
    const root = projectWith("pages/index.md", "# Hi\n");

    const update = dataUpdateFor(
      join(root, "pages/index.md"),
      join(root, "data"),
      undefined,
      DEFAULT_INTERPRETERS,
    );

    expect(update).toBeNull();
  });

  it("ignores the data directory itself", () => {
    const root = projectWith("data/a.csv", "x\n1\n");

    const update = dataUpdateFor(
      join(root, "data"),
      join(root, "data"),
      undefined,
      DEFAULT_INTERPRETERS,
    );

    expect(update).toBeNull();
  });

  it("ignores an empty file, a write still in progress", () => {
    const root = projectWith("data/a.csv", "");

    const update = dataUpdateFor(
      join(root, "data/a.csv"),
      join(root, "data"),
      undefined,
      DEFAULT_INTERPRETERS,
    );

    expect(update).toBeNull();
  });

  it("ignores a missing file", () => {
    const root = makeTempProject();

    const update = dataUpdateFor(
      join(root, "data/gone.csv"),
      join(root, "data"),
      undefined,
      DEFAULT_INTERPRETERS,
    );

    expect(update).toBeNull();
  });
});

describe("dataUpdateFor — mtime guard", () => {
  it("ignores a change whose mtime equals the version already sent", () => {
    const root = projectWith("data/a.csv", "x\n1\n");
    const file = join(root, "data/a.csv");

    const update = dataUpdateFor(
      file,
      join(root, "data"),
      statSync(file).mtimeMs,
      DEFAULT_INTERPRETERS,
    );

    expect(update).toBeNull();
  });

  it("fires again once the mtime moves past the version already sent", () => {
    const root = projectWith("data/a.csv", "x\n1\n");
    const file = join(root, "data/a.csv");
    const sent = statSync(file).mtimeMs;
    const later = new Date(Date.now() + 60_000);
    utimesSync(file, later, later);

    const update = dataUpdateFor(
      file,
      join(root, "data"),
      sent,
      DEFAULT_INTERPRETERS,
    );

    expect(update?.version).toBe(statSync(file).mtimeMs);
  });
});
