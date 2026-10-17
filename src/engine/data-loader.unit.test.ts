import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  utimesSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../../test/lib/temp-project.js";
import {
  createDataLoaderCache,
  DataLoaderError,
  findDataLoader,
  isDataLoaderSource,
} from "./data-loader.js";

// Every run appends one line to runs.log, resolved against the loader's
// cwd — so the log both counts runs and proves the cwd is the project root.
const COUNTING_LOADER = `
import { appendFileSync } from "node:fs";
appendFileSync("runs.log", "run\\n");
process.stdout.write("x,y\\n1,2\\n");
`;

afterEach(() => {
  cleanupProjects();
});

function projectWithLoader(source: string): string {
  const root = makeTempProject("biac-loader-");
  writeProjectFile(root, "data/a.csv.js", source);
  return root;
}

function runCount(root: string): number {
  const log = join(root, "runs.log");
  return existsSync(log) ? readFileSync(log, "utf8").split("\n").length - 1 : 0;
}

function cacheDirEntries(root: string): string[] {
  return readdirSync(join(root, ".biac/cache/data"));
}

describe("isDataLoaderSource", () => {
  it.each(["a.csv.js", "lib/x.js", "A.CSV.JS"])(
    "treats %s as private source",
    (path) => {
      expect(isDataLoaderSource(path)).toBe(true);
    },
  );

  it.each(["a.csv", "a.json", "a.js.csv"])("treats %s as data", (path) => {
    expect(isDataLoaderSource(path)).toBe(false);
  });
});

describe("findDataLoader", () => {
  it("returns the loader beside a target that has no static file", () => {
    const root = projectWithLoader(COUNTING_LOADER);

    const loader = findDataLoader(join(root, "data"), "a.csv");

    expect(loader).toBe(join(root, "data/a.csv.js"));
  });

  it("returns null when a static file exists at the target", () => {
    const root = projectWithLoader(COUNTING_LOADER);
    writeProjectFile(root, "data/a.csv", "x\n1\n");

    expect(findDataLoader(join(root, "data"), "a.csv")).toBeNull();
  });

  it("returns null when neither a file nor a loader exists", () => {
    const root = makeTempProject("biac-loader-");

    expect(findDataLoader(join(root, "data"), "a.csv")).toBeNull();
  });
});

describe("load — output and cache", () => {
  it("writes the loader's stdout to .biac/cache/data/<target>", async () => {
    const root = projectWithLoader(COUNTING_LOADER);

    const output = await createDataLoaderCache(root).load("a.csv");

    expect(output).toBe(join(root, ".biac/cache/data/a.csv"));
    expect(readFileSync(output, "utf8")).toBe("x,y\n1,2\n");
    expect(cacheDirEntries(root)).toEqual(["a.csv"]);
  });

  it("runs the loader with the project root as its working directory", async () => {
    const root = projectWithLoader("process.stdout.write(process.cwd());\n");

    const output = await createDataLoaderCache(root).load("a.csv");

    expect(readFileSync(output, "utf8")).toBe(realpathSync(root));
  });
});

describe("load — freshness", () => {
  it("serves a cache at least as new as the loader without re-running", async () => {
    const root = projectWithLoader(COUNTING_LOADER);
    const cache = createDataLoaderCache(root);
    await cache.load("a.csv");

    await createDataLoaderCache(root).load("a.csv");

    expect(runCount(root)).toBe(1);
  });

  it("re-runs the loader when it is newer than its cache", async () => {
    const root = projectWithLoader(COUNTING_LOADER);
    const cache = createDataLoaderCache(root);
    await cache.load("a.csv");
    const later = new Date(Date.now() + 60_000);
    utimesSync(join(root, "data/a.csv.js"), later, later);

    await cache.load("a.csv");

    expect(runCount(root)).toBe(2);
  });
});

describe("load — concurrency", () => {
  it("spawns one process for concurrent loads of one target", async () => {
    const root = projectWithLoader(COUNTING_LOADER);
    const cache = createDataLoaderCache(root);

    const outputs = await Promise.all([
      cache.load("a.csv"),
      cache.load("a.csv"),
      cache.load("a.csv"),
    ]);

    expect(new Set(outputs).size).toBe(1);
    expect(runCount(root)).toBe(1);
  });
});

describe("load — failure", () => {
  const FAILING_LOADER = `
process.stdout.write("partial");
process.stderr.write("first line\\nboom\\n");
process.exit(3);
`;

  it("rejects naming the loader, its exit code and its stderr tail", async () => {
    const root = projectWithLoader(FAILING_LOADER);

    const error = await createDataLoaderCache(root)
      .load("a.csv")
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(DataLoaderError);
    expect(error).toMatchObject({
      loader: "data/a.csv.js",
      exitCode: 3,
      stderrTail: "first line\nboom",
    });
    expect((error as Error).message).toContain("data/a.csv.js");
    expect((error as Error).message).toContain("code 3");
  });

  it("leaves neither a cache file nor a temp file behind", async () => {
    const root = projectWithLoader(FAILING_LOADER);

    await createDataLoaderCache(root)
      .load("a.csv")
      .catch(() => undefined);

    expect(cacheDirEntries(root)).toEqual([]);
  });

  it("runs again on the next load after a failure", async () => {
    const root = projectWithLoader(FAILING_LOADER);
    const cache = createDataLoaderCache(root);
    await cache.load("a.csv").catch(() => undefined);
    writeProjectFile(root, "data/a.csv.js", COUNTING_LOADER);

    await cache.load("a.csv");

    expect(runCount(root)).toBe(1);
  });
});
