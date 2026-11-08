import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const COMMITLINT_CLI = join(REPO_ROOT, "node_modules/@commitlint/cli/cli.js");

/** zizmor's `dependabot-cooldown` audit flags anything under this many days. */
const MINIMUM_COOLDOWN_DAYS = 7;

interface UpdateBlock {
  "package-ecosystem": string;
  directory?: string;
  directories?: string[];
  schedule: { interval: string };
  cooldown?: { "default-days": number };
  "commit-message"?: { prefix: string; include?: string };
  groups?: Record<string, { patterns?: string[]; "update-types"?: string[] }>;
}

function readUpdateBlocks(): UpdateBlock[] {
  const file = readFileSync(join(REPO_ROOT, ".github/dependabot.yml"), "utf8");
  return (parse(file) as { updates: UpdateBlock[] }).updates;
}

function updateFor(ecosystem: string): UpdateBlock {
  const block = readUpdateBlocks().find(
    (candidate) => candidate["package-ecosystem"] === ecosystem,
  );
  if (!block) {
    throw new Error(
      `.github/dependabot.yml has no update block for ecosystem "${ecosystem}"`,
    );
  }
  return block;
}

/** The longest dependency name Dependabot could put in a single-package title. */
function longestManifestDependency(): string {
  const names = ["package.json", "src/web/package.json"].flatMap((manifest) => {
    const parsed = JSON.parse(readFileSync(join(REPO_ROOT, manifest), "utf8"));
    return [
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {}),
    ];
  });
  return names.reduce((longest, name) =>
    name.length > longest.length ? name : longest,
  );
}

function commitlintStatus(header: string): { status: number; output: string } {
  const run = spawnSync(process.execPath, [COMMITLINT_CLI], {
    cwd: REPO_ROOT,
    input: header,
    encoding: "utf8",
  });
  return { status: run.status ?? -1, output: run.stdout + run.stderr };
}

/** The scope Dependabot appends after the prefix when `include: scope` is set. */
function titleHeaders(block: UpdateBlock): string[] {
  const prefix = block["commit-message"]?.prefix ?? "";
  const dependency = longestManifestDependency();
  const directory = " in /src/web";
  const single = `bump ${dependency} from 10.10.10 to 11.11.11${directory}`;
  const group =
    "bump the minor-and-patch group across 2 directories with 12 updates";
  return [
    `${prefix}(deps): ${single}`,
    `${prefix}(deps-dev): ${single}`,
    `${prefix}(deps): ${group}`,
  ];
}

describe("dependabot.yml", () => {
  const ecosystems = ["github-actions", "npm", "docker"];

  it.each(ecosystems)(
    "%s updates weekly behind a %i-day cooldown",
    (ecosystem) => {
      const block = updateFor(ecosystem);

      expect(block.schedule.interval).toBe("weekly");
      expect(block.cooldown?.["default-days"]).toBeGreaterThanOrEqual(
        MINIMUM_COOLDOWN_DAYS,
      );
    },
  );

  it.each(ecosystems)(
    "%s groups minor and patch bumps into one pull request",
    (ecosystem) => {
      const groups = Object.values(updateFor(ecosystem).groups ?? {});

      expect(groups).toHaveLength(1);
      expect(groups[0]?.patterns).toEqual(["*"]);
      expect(groups[0]?.["update-types"]).toEqual(["minor", "patch"]);
    },
  );

  it("prefixes github-actions titles with ci and npm and docker with build", () => {
    const prefixes = Object.fromEntries(
      ecosystems.map((ecosystem) => [
        ecosystem,
        updateFor(ecosystem)["commit-message"],
      ]),
    );

    expect(prefixes).toEqual({
      "github-actions": { prefix: "ci", include: "scope" },
      npm: { prefix: "build", include: "scope" },
      docker: { prefix: "build", include: "scope" },
    });
  });

  it.each(ecosystems)(
    "%s titles pass the repository's commitlint rules, longest dependency name included",
    (ecosystem) => {
      const failures = titleHeaders(updateFor(ecosystem))
        .map((header) => ({ header, ...commitlintStatus(header) }))
        .filter((result) => result.status !== 0);

      expect(failures).toEqual([]);
    },
  );
});
