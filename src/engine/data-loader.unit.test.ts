import {
  chmodSync,
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
import { DEFAULT_INTERPRETERS } from "./data-loader-interpreters.js";
import {
  createDataLoaderCache,
  dataLoaderTarget,
  DataLoaderError,
  DataLoaderFailure,
  findDataLoader,
  isDataLoaderSource,
  listDataLoaderTargets,
  type DataLoaderLog,
} from "./data-loader.js";

/** Keeps every line and stderr chunk a cache reports, in arrival order. */
class RecordingLoaderLog implements DataLoaderLog {
  readonly infos: string[] = [];
  readonly errors: string[] = [];
  readonly stderrChunks: string[] = [];
  info(line: string): void {
    this.infos.push(line);
  }
  error(line: string): void {
    this.errors.push(line);
  }
  stderr(chunk: string): void {
    this.stderrChunks.push(chunk);
  }
}

function cacheFor(
  root: string,
  log = new RecordingLoaderLog(),
  interpreters = DEFAULT_INTERPRETERS,
) {
  return createDataLoaderCache(root, log, interpreters);
}

// Every run appends one line to runs.log, resolved against the loader's
// cwd — so the log both counts runs and proves the cwd is the project root.
const COUNTING_LOADER = `
import { appendFileSync } from "node:fs";
appendFileSync("runs.log", "run\\n");
process.stdout.write("x,y\\n1,2\\n");
`;

const PYTHON_LOADER = 'print("x,y")\nprint("1,2")\n';
const SHELL_LOADER = "printf 'x,y\\n1,2\\n'\n";
// Type annotations prove the file runs through Node's type stripping.
const TYPESCRIPT_LOADER =
  'const rows: string[] = ["x,y", "1,2"];\nprocess.stdout.write(rows.join("\\n") + "\\n");\n';

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
  it.each([
    "a.csv.js",
    "lib/x.js",
    "A.CSV.JS",
    "a.csv.py",
    "lib/util.py",
    "A.CSV.PY",
    "a.csv.sh",
    "a.csv.ts",
    "a.csv.exe",
  ])("treats %s as private source", (path) => {
    expect(isDataLoaderSource(path, DEFAULT_INTERPRETERS)).toBe(true);
  });

  it.each(["a.csv", "a.json", "a.js.csv"])("treats %s as data", (path) => {
    expect(isDataLoaderSource(path, DEFAULT_INTERPRETERS)).toBe(false);
  });
});

describe("dataLoaderTarget", () => {
  it.each([
    ["a.csv.js", "a.csv"],
    [join("nested", "b.parquet.js"), "nested/b.parquet"],
    ["a.csv.py", "a.csv"],
    ["b.json.sh", "b.json"],
  ])("maps %s to %s", (loader, target) => {
    expect(dataLoaderTarget(loader, DEFAULT_INTERPRETERS)).toBe(target);
  });
});

describe("findDataLoader", () => {
  it("returns the loader beside a target that has no static file", () => {
    const root = projectWithLoader(COUNTING_LOADER);

    const loader = findDataLoader(
      join(root, "data"),
      "a.csv",
      DEFAULT_INTERPRETERS,
    );

    expect(loader).toBe(join(root, "data/a.csv.js"));
  });

  it("returns null when a static file exists at the target", () => {
    const root = projectWithLoader(COUNTING_LOADER);
    writeProjectFile(root, "data/a.csv", "x\n1\n");

    expect(
      findDataLoader(join(root, "data"), "a.csv", DEFAULT_INTERPRETERS),
    ).toBeNull();
  });

  it("returns null when neither a file nor a loader exists", () => {
    const root = makeTempProject("biac-loader-");

    expect(
      findDataLoader(join(root, "data"), "a.csv", DEFAULT_INTERPRETERS),
    ).toBeNull();
  });

  it("returns null for a target without its own extension, so a helper module never runs", () => {
    const root = makeTempProject("biac-loader-");
    writeProjectFile(root, "data/lib/helper.js", COUNTING_LOADER);

    expect(
      findDataLoader(join(root, "data"), "lib/helper", DEFAULT_INTERPRETERS),
    ).toBeNull();
  });
});

describe("findDataLoader — languages", () => {
  it("returns a loader in any registered language", () => {
    const root = makeTempProject("biac-loader-");
    writeProjectFile(root, "data/a.csv.py", PYTHON_LOADER);

    const loader = findDataLoader(
      join(root, "data"),
      "a.csv",
      DEFAULT_INTERPRETERS,
    );

    expect(loader).toBe(join(root, "data/a.csv.py"));
  });

  it("throws naming every loader when two generate one target", () => {
    const root = projectWithLoader(COUNTING_LOADER);
    writeProjectFile(root, "data/a.csv.py", PYTHON_LOADER);

    expect(() =>
      findDataLoader(join(root, "data"), "a.csv", DEFAULT_INTERPRETERS),
    ).toThrow(
      new DataLoaderFailure(
        "data/a.csv has 2 data loaders, expected 1: data/a.csv.js, data/a.csv.py",
      ),
    );
  });

  it("returns null over two loaders when a static file exists at the target", () => {
    const root = projectWithLoader(COUNTING_LOADER);
    writeProjectFile(root, "data/a.csv.py", PYTHON_LOADER);
    writeProjectFile(root, "data/a.csv", "x\n1\n");

    expect(
      findDataLoader(join(root, "data"), "a.csv", DEFAULT_INTERPRETERS),
    ).toBeNull();
  });
});

describe("listDataLoaderTargets", () => {
  it("lists every loader's target under data/, nested ones included, sorted", () => {
    const root = projectWithLoader(COUNTING_LOADER);
    writeProjectFile(root, "data/nested/deep/b.parquet.js", COUNTING_LOADER);

    const targets = listDataLoaderTargets(
      join(root, "data"),
      DEFAULT_INTERPRETERS,
    );

    expect(targets).toEqual(["a.csv", "nested/deep/b.parquet"]);
  });

  it("skips a loader shadowed by a static file at its target", () => {
    const root = projectWithLoader(COUNTING_LOADER);
    writeProjectFile(root, "data/a.csv", "x\n1\n");

    expect(
      listDataLoaderTargets(join(root, "data"), DEFAULT_INTERPRETERS),
    ).toEqual([]);
  });

  it("skips a helper module whose name has no data extension", () => {
    const root = projectWithLoader(COUNTING_LOADER);
    writeProjectFile(root, "data/lib/helper.js", "export const x = 1;\n");

    expect(
      listDataLoaderTargets(join(root, "data"), DEFAULT_INTERPRETERS),
    ).toEqual(["a.csv"]);
  });

  it("lists the targets of loaders in every language", () => {
    const root = makeTempProject("biac-loader-");
    writeProjectFile(root, "data/a.csv.py", PYTHON_LOADER);
    writeProjectFile(root, "data/b.csv.sh", SHELL_LOADER);

    const targets = listDataLoaderTargets(
      join(root, "data"),
      DEFAULT_INTERPRETERS,
    );

    expect(targets).toEqual(["a.csv", "b.csv"]);
  });

  it("throws when two loaders generate one target", () => {
    const root = projectWithLoader(COUNTING_LOADER);
    writeProjectFile(root, "data/a.csv.sh", SHELL_LOADER);

    expect(() =>
      listDataLoaderTargets(join(root, "data"), DEFAULT_INTERPRETERS),
    ).toThrow(DataLoaderFailure);
  });

  it("returns no targets for a project without data/", () => {
    const root = makeTempProject("biac-loader-");

    expect(
      listDataLoaderTargets(join(root, "data"), DEFAULT_INTERPRETERS),
    ).toEqual([]);
  });
});

describe("load — output and cache", () => {
  it("writes the loader's stdout to .biac/cache/data/<target>", async () => {
    const root = projectWithLoader(COUNTING_LOADER);

    const output = await cacheFor(root).load("a.csv");

    expect(output).toBe(join(root, ".biac/cache/data/a.csv"));
    expect(readFileSync(output, "utf8")).toBe("x,y\n1,2\n");
    expect(cacheDirEntries(root)).toEqual(["a.csv"]);
  });

  it("runs the loader with the project root as its working directory", async () => {
    const root = projectWithLoader("process.stdout.write(process.cwd());\n");

    const output = await cacheFor(root).load("a.csv");

    expect(readFileSync(output, "utf8")).toBe(realpathSync(root));
  });
});

describe("load — languages", () => {
  it.each([
    ["a.csv.py", PYTHON_LOADER],
    ["a.csv.sh", SHELL_LOADER],
    ["a.csv.ts", TYPESCRIPT_LOADER],
    ["a.csv.exe", `#!/bin/sh\n${SHELL_LOADER}`],
  ])("writes the stdout of %s", async (loader, source) => {
    const root = makeTempProject("biac-loader-");
    writeProjectFile(root, `data/${loader}`, source);
    chmodSync(join(root, "data", loader), 0o755);

    const output = await cacheFor(root).load("a.csv");

    expect(readFileSync(output, "utf8")).toBe("x,y\n1,2\n");
  });

  it("rejects naming the loader and its command when the command is not on PATH", async () => {
    const root = makeTempProject("biac-loader-");
    writeProjectFile(root, "data/a.csv.py", PYTHON_LOADER);
    const log = new RecordingLoaderLog();

    const error = await cacheFor(root, log, { ".py": ["biac-missing-command"] })
      .load("a.csv")
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(DataLoaderFailure);
    expect((error as Error).message).toBe(
      'data loader data/a.csv.py could not start: command "biac-missing-command" not found on PATH',
    );
    expect(log.errors).toEqual([(error as Error).message]);
  });
});

describe("load — freshness", () => {
  it("serves a cache at least as new as the loader without re-running", async () => {
    const root = projectWithLoader(COUNTING_LOADER);
    const cache = cacheFor(root);
    await cache.load("a.csv");

    await cacheFor(root).load("a.csv");

    expect(runCount(root)).toBe(1);
  });

  it("re-runs the loader when it is newer than its cache", async () => {
    const root = projectWithLoader(COUNTING_LOADER);
    const cache = cacheFor(root);
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
    const cache = cacheFor(root);

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

    const error = await cacheFor(root)
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

    await cacheFor(root)
      .load("a.csv")
      .catch(() => undefined);

    expect(cacheDirEntries(root)).toEqual([]);
  });

  it("runs again on the next load after a failure", async () => {
    const root = projectWithLoader(FAILING_LOADER);
    const cache = cacheFor(root);
    await cache.load("a.csv").catch(() => undefined);
    writeProjectFile(root, "data/a.csv.js", COUNTING_LOADER);

    await cache.load("a.csv");

    expect(runCount(root)).toBe(1);
  });
});

describe("load — dev log", () => {
  it("logs one line naming the loader, its output size and duration", async () => {
    const root = projectWithLoader(COUNTING_LOADER);
    const log = new RecordingLoaderLog();

    await cacheFor(root, log).load("a.csv");

    expect(log.infos).toHaveLength(1);
    expect(log.infos[0]).toMatch(
      /^data loader data\/a\.csv\.js → 8 bytes in \d+ ms$/,
    );
    expect(log.errors).toEqual([]);
  });

  it("logs nothing when the cached output is served", async () => {
    const root = projectWithLoader(COUNTING_LOADER);
    await cacheFor(root).load("a.csv");
    const log = new RecordingLoaderLog();

    await cacheFor(root, log).load("a.csv");

    expect(log.infos).toEqual([]);
  });

  it("logs an empty output as empty and still serves it", async () => {
    const root = projectWithLoader("");
    const log = new RecordingLoaderLog();

    const output = await cacheFor(root, log).load("a.csv");

    expect(readFileSync(output, "utf8")).toBe("");
    expect(log.infos[0]).toMatch(
      /^data loader data\/a\.csv\.js → empty output in \d+ ms$/,
    );
  });

  it("logs a failure as the error the load rejects with", async () => {
    const root = projectWithLoader(
      'process.stderr.write("boom\\n");\nprocess.exit(3);\n',
    );
    const log = new RecordingLoaderLog();

    const error = await cacheFor(root, log)
      .load("a.csv")
      .catch((thrown: unknown) => thrown);

    expect(log.errors).toEqual([(error as Error).message]);
    expect(log.infos).toEqual([]);
  });

  it("forwards the loader's stderr as it is written", async () => {
    const root = projectWithLoader(
      'process.stderr.write("fetching rows\\n");\nprocess.stdout.write("x\\n");\n',
    );
    const log = new RecordingLoaderLog();

    await cacheFor(root, log).load("a.csv");

    expect(log.stderrChunks.join("")).toBe("fetching rows\n");
  });
});
