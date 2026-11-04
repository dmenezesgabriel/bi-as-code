---
title: Data loaders
icon: server
sidebar_position: 204
keywords:
  [
    data loader,
    loader,
    script,
    program,
    generate,
    snapshot,
    python,
    javascript,
    shell,
    interpreter,
    cache,
    csv,
    parquet,
    api,
    warehouse,
  ]
sql:
  island_summary: data/island-summary.csv
---

# Data loaders

A data loader is a program that prints a data file. Put it in `data/` with the file's name followed by the language's extension, and biac runs it whenever a page needs the file: `data/island-summary.csv.js` produces `data/island-summary.csv`. Use one for data that no file in the repository holds, such as a warehouse extract, an API response or a summary computed from another file. The page reads the output like any other data file, and the site that `biac build` writes ships the output and never the program.

## A program that prints a file

The loader below reads `data/penguins.csv` and prints one row per island. Whatever the program writes to standard output is the file.

```js
// One row per island: its penguins and their mean body mass in grams.
// A loader runs from the project root, so its paths start at `data/`.
import { readFileSync } from "node:fs";

const [header, ...lines] = readFileSync("data/penguins.csv", "utf8")
  .trim()
  .split("\n");
const columns = header.split(",");
const islandAt = columns.indexOf("island");
const massAt = columns.indexOf("body_mass_g");

const byIsland = new Map();
for (const line of lines) {
  const cells = line.split(",");
  const island = byIsland.get(cells[islandAt]) ?? {
    penguins: 0,
    weighed: 0,
    grams: 0,
  };
  island.penguins += 1;
  if (cells[massAt] !== "") {
    island.weighed += 1;
    island.grams += Number(cells[massAt]);
  }
  byIsland.set(cells[islandAt], island);
}

// The loader's stdout is the file, so the CSV goes out on stdout.
console.log("island,penguins,mean_body_mass_g");
for (const [island, { penguins, weighed, grams }] of byIsland) {
  console.log(`${island},${penguins},${Math.round(grams / weighed)}`);
}
```

The file name carries the output's format. `island-summary.csv.js` makes `island-summary.csv`, so a loader that prints Parquet is `island-summary.parquet.js`. A page registers the output in `sql:` by the name without the language, the way it registers a file written by hand. This page declares the table `island_summary` for `data/island-summary.csv` and queries it:

```yaml
sql:
  island_summary: data/island-summary.csv
```

```sql islands echo
select island, penguins, mean_body_mass_g
from island_summary
order by island
```

```mdx echo
<Table data="islands" />
```

The rules for registering a table and for the fence are on [SQL tables and fences](/sql/sql-tables-and-fences).

## Which file a loader makes

The output keeps its own extension, so a loader needs two: the format and the language. A path without a format extension has no loader, which makes `data/lib/rows.py` a helper that a loader may import and that biac never runs by itself.

| Situation                                            | Result                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `data/quakes.csv.py` and no `data/quakes.csv`        | `data/quakes.csv` is the loader's output                             |
| `data/quakes.csv.py` beside a file `data/quakes.csv` | the file is read, and the loader never runs                          |
| `data/quakes.csv.js` and `data/quakes.csv.py`        | an error that names both, because choosing one would leave one stale |
| `data/lib/rows.py`                                   | not a loader, because `lib/rows` has no extension of its own         |
| `data/nested/b.parquet.py`                           | `data/nested/b.parquet`, with the folder kept                        |

Two loaders for one output stop the page and the build with the message below:

```text
data/quakes.csv has 2 data loaders, expected 1: data/quakes.csv.js, data/quakes.csv.py
```

## Languages

The extension after the format picks the program that runs the loader. biac appends the loader's path to that program's command, so `.py` runs `python3 data/quakes.csv.py` and `.sh` runs `sh data/quakes.csv.sh`. The default table, with the twelve languages, is under `interpreters` on [biac.config.ts](/pages/biac-config), where a project adds a language, replaces a command or drops an extension.

`.js` and `.ts` run with the node that runs biac, so they need nothing installed. Every other language needs its interpreter on the `PATH` of the shell that started biac, with any library the loader imports. A `.exe` loader is the executable itself, and it needs its executable bit set (`chmod +x data/quakes.csv.exe`).

A command that is not on the `PATH` fails with a message that names the loader and the command:

```text
data loader data/quakes.csv.sh could not start: command "no-such-tool" not found on PATH
```

A loader that uses a virtual environment runs inside it when the environment is active in the shell that started `biac dev` or `biac build`.

## Running a loader

A loader runs with the project root as its working directory, wherever `biac` was started, so `data/penguins.csv` means the same file for every author. It reads no standard input. What it writes to standard output becomes the file, and what it writes to standard error is shown in the terminal as it is written. An exit code other than 0 is a failure, and a failed run writes no output. Two requests for one output at the same moment share one run.

Each finished run prints one line in the terminal that runs `biac dev` or `biac build`, after the time stamp of vite, with the program, the size of the output and the time it took:

```text
10:12:41 AM [vite] data loader data/island-summary.csv.js → 82 bytes in 41 ms
```

An output with no bytes is still a file, and the line reads `empty output`. A CSV with no bytes is an empty table.

## Cache

An output is kept at `.biac/cache/data/<output>` under the project root, with the folders of its path, outside `data/` so that the dev server never serves the cache and the build never copies it. biac runs a loader again only when the loader file is newer than its output.

That is the only thing biac compares. A change to what the loader reads, such as the rows of a table or the answer of an API, does not run it again, and neither does a new command for its language in `interpreters`. Delete `.biac/cache/` to run every loader again. `.biac/` belongs in `.gitignore`.

## Under `biac dev` and `biac build`

Under `biac dev`, a loader runs the first time its output is needed. Saving the loader runs it again for the next request and updates the pages that read it, without a reload.

`biac build` runs every loader under `data/` that makes an output, whether or not a page reads it, before it writes anything, so a loader that fails stops the build with its message and leaves no half-written `build/`. The site then holds the outputs in `build/data/` and no program. The result is a snapshot, as old as the build: a deployed site never runs a loader, so rebuild on a schedule to refresh data.

No file under `data/` whose name ends in the extension of a language in the table is served or copied, upper or lower case, which keeps a connection string in a loader off the site. That includes a program that is not a loader, such as a `.py` helper, and a file that was meant as static data under such a name. Rename it to a data extension, or generate it with a loader.

## Errors

A loader that exits with a code other than 0 names itself, the code and the last twenty lines it wrote to standard error:

```text
data loader data/quakes.csv.js exited with code 3, expected 0; stderr:
upstream timed out
```

Under `biac dev`, every widget and fence that reads the output shows the dev server's message after the fence's name and the table it could not register, while the rest of the page renders. If the loader of this page broke, the `islands` fence would show:

```text
islands: registerTable failed (island_summary ← data/island-summary.csv): Error: fetch http://localhost:5173/data/island-summary.csv → HTTP 500: data loader data/island-summary.csv.js exited with code 3, expected 0; stderr: upstream timed out
```

A failing loader runs twice for one page load under `biac dev`: once for the read, and once to fetch the reason that DuckDB cannot report. Under `biac build` the same message ends the build. The two other failures, a missing command and two loaders for one output, are quoted above.
