import { existsSync } from "node:fs";
import { copyFile, cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  createDataLoaderCache,
  isDataLoaderSource,
  listDataLoaderTargets,
  type DataLoaderLog,
} from "./data-loader.js";
import { statFile } from "./stat-file.js";
import type { DataLoaderInterpreters } from "./types.js";

/**
 * Copies the whole `data/` tree unhashed: `sql:` sources fetch `/data/<path>`
 * in dev and in the built site alike, so page SQL never rewrites. Symlinks
 * are followed because the dev mount serves their targets too. Loader
 * sources and the modules they import are program code that may hold
 * credentials, so they are never copied. A project without `data/` copies
 * nothing.
 */
export async function copyDataDir(
  dataDir: string,
  outDataDir: string,
  interpreters: DataLoaderInterpreters,
): Promise<void> {
  if (!existsSync(dataDir)) return;
  await cp(dataDir, outDataDir, {
    recursive: true,
    dereference: true,
    filter: (source) =>
      !(isDataLoaderSource(source, interpreters) && statFile(source)),
  });
}

/**
 * Runs every loader under `<root>/data/` one after another, re-running
 * only those edited since their cached output, and maps each target to
 * that output. Every loader runs, not only those a page names: dev serves
 * any loader's output at `/data/<target>`, so the build ships the same set.
 */
export async function runDataLoaders(
  root: string,
  log: DataLoaderLog,
  interpreters: DataLoaderInterpreters,
): Promise<Map<string, string>> {
  const cache = createDataLoaderCache(root, log);
  const outputs = new Map<string, string>();
  const dataDir = join(root, "data");
  for (const target of listDataLoaderTargets(dataDir, interpreters)) {
    // eslint-disable-next-line react-doctor/async-await-in-loop -- one at a time keeps each loader's forwarded stderr contiguous and spares the remote APIs loaders call
    outputs.set(target, await cache.load(target, interpreters));
  }
  return outputs;
}

/** Writes each loader output at its target path under `build/data/`. */
export async function copyLoaderOutputs(
  outputs: Map<string, string>,
  outDataDir: string,
): Promise<void> {
  for (const [target, output] of outputs) {
    const destination = join(outDataDir, target);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(output, destination);
  }
}
