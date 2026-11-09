import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { makeTempProject, writeProjectFile } from "./temp-project.js";

export type PackageManager = "npm" | "pnpm";

/** An ext4 path: an installed `node_modules` is hundreds of MB, and `/tmp` can be RAM. */
const DISK_PARENT = join(homedir(), ".cache");

/**
 * Makes a scratch directory on disk, removed by `cleanupProjects`.
 *
 * @example
 * const consumer = makeDiskProject("biac-install-npm-");
 */
export function makeDiskProject(prefix: string): string {
  mkdirSync(DISK_PARENT, { recursive: true });
  return makeTempProject(prefix, DISK_PARENT);
}

/**
 * This process's environment without the settings a package-manager script
 * run exports. `pnpm test:install` copies this repo's `pnpm-workspace.yaml`
 * (`trustPolicy`, `minimumReleaseAge`) into `npm_config_*` variables, and a
 * child `pnpm add` would apply them to the consumer; a user's shell has none.
 */
function consumerEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (/^(npm_|pnpm_config_)/i.test(name)) delete environment[name];
  }
  return environment;
}

function run(command: PackageManager, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd,
    env: consumerEnvironment(),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited ${result.status} in ${cwd}:\n${result.stderr}${result.stdout}`,
    );
  }
  return result.stdout;
}

/**
 * Packs the repo into `<destination>/biac-<version>.tgz` and returns that
 * path. Scripts stay off because the caller built `dist/` already and
 * `prepack`'s banner would land ahead of the JSON.
 *
 * @example
 * const tarball = packTarball(makeDiskProject("biac-pack-"));
 */
export function packTarball(destination: string): string {
  const repoRoot = join(import.meta.dirname, "../..");
  const output = run(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", destination],
    repoRoot,
  );
  const [packed] = JSON.parse(output) as { filename: string }[];
  return join(destination, packed!.filename);
}

/**
 * Installs `tarball` into `root` as a user would with `npm i` or `pnpm add`;
 * pnpm skips install scripts by default, so success also shows none is needed.
 *
 * @example
 * installTarball("pnpm", consumer, tarball);
 */
export function installTarball(
  manager: PackageManager,
  root: string,
  tarball: string,
): void {
  writeProjectFile(
    root,
    "package.json",
    '{ "name": "consumer", "private": true, "type": "module" }\n',
  );
  const args =
    manager === "npm"
      ? ["install", "--no-audit", "--no-fund", tarball]
      : ["add", tarball];
  run(manager, args, root);
}
