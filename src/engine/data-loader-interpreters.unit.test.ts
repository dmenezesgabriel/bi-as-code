import { describe, expect, it } from "vitest";
import {
  DEFAULT_INTERPRETERS,
  loaderCommand,
  loaderExtension,
} from "./data-loader-interpreters.js";

describe("DEFAULT_INTERPRETERS", () => {
  it("registers the twelve default loader languages", () => {
    expect(Object.keys(DEFAULT_INTERPRETERS).sort()).toEqual(
      [".R", ".exe", ".go", ".java", ".jl", ".js", ".php", ".py", ".r", ".rs"]
        .concat([".sh", ".ts"])
        .sort(),
    );
  });

  it.each([".js", ".ts"])(
    "runs %s loaders with the node running biac",
    (ext) => {
      expect(DEFAULT_INTERPRETERS[ext]).toEqual([process.execPath]);
    },
  );

  it("runs an .exe loader as the file itself", () => {
    expect(DEFAULT_INTERPRETERS[".exe"]).toEqual([]);
  });
});

describe("loaderExtension", () => {
  it.each([
    ["a.csv.py", ".py"],
    ["nested/b.parquet.sh", ".sh"],
    ["a.csv.PY", ".py"],
    ["a.csv.R", ".r"],
  ])("finds the registered extension of %s", (path, expected) => {
    expect(loaderExtension(path, DEFAULT_INTERPRETERS)?.toLowerCase()).toBe(
      expected,
    );
  });

  it.each(["a.csv", "a.pyc", "notes.txt", "py"])(
    "is null for %s, which no interpreter runs",
    (path) => {
      expect(loaderExtension(path, DEFAULT_INTERPRETERS)).toBeNull();
    },
  );
});

describe("loaderCommand", () => {
  it("appends the loader to its interpreter's argv", () => {
    expect(loaderCommand("data/a.csv.go", DEFAULT_INTERPRETERS)).toEqual([
      "go",
      "run",
      "data/a.csv.go",
    ]);
  });

  it("runs an .exe loader by its own path", () => {
    expect(loaderCommand("/site/data/a.csv.exe", DEFAULT_INTERPRETERS)).toEqual(
      ["/site/data/a.csv.exe"],
    );
  });

  it("matches the extension case-sensitively", () => {
    const interpreters = { ".r": ["lower"], ".R": ["upper"] };

    expect(loaderCommand("a.csv.R", interpreters)).toEqual([
      "upper",
      "a.csv.R",
    ]);
  });

  it("throws naming the path and the registered extensions when none matches", () => {
    expect(() => loaderCommand("a.csv.PY", { ".py": ["python3"] })).toThrow(
      'no interpreter for "a.csv.PY"; expected one of: .py',
    );
  });
});
