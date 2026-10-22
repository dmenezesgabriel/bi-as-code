import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBiacConfig } from "./biac-config.js";
import { compilePage } from "./compile-page.js";
import { diskQueryFiles } from "./disk-query-files.js";
import { discoverPages } from "./discover-pages.js";
import { loadProjectTranslations } from "./resolve-translations.js";
import { TEMPLATE_TOKEN } from "./query-files.js";
import type {
  CompiledPage,
  ExportedWidgetTag,
  PageLayout,
  SqlBlock,
  SqlTableMap,
} from "./types.js";

/**
 * What the build bakes into one exported widget module — structurally the
 * web mount entry's `WidgetSpec` (src/web/src/features/widget-module/
 * types.ts); the engine cannot import the web's type, so the integration
 * test and the mount itself guard the match.
 */
export interface BakedWidgetSpec {
  readonly widget: string;
  readonly props: Record<string, string>;
  readonly sqlBlocks: readonly SqlBlock[];
  readonly sqlTables: SqlTableMap;
  readonly cards: boolean;
}

/** One widget module the build emits at `build/widgets/<name>.js`. */
export interface ExportedWidgetModule {
  readonly name: string;
  /** The page that declares it, for build errors. */
  readonly file: string;
  readonly spec: BakedWidgetSpec;
}

/** The web files the baked entry imports, resolved by the build command. */
export interface WidgetModuleRuntimePaths {
  readonly mountWidget: string;
  readonly moduleRuntime: string;
}

/**
 * The entry source the library-mode build compiles for one widget module:
 * the spec baked as JSON, the module's own DuckDB layer (its URLs resolve
 * against the module's origin), and a default export the host page calls
 * with its container. The module's layer wins over any option the host
 * passes — the host has no `DuckDb` port to inject.
 *
 * @example
 * widgetEntrySource(module, { mountWidget: "/web/…/mount-widget.tsx", moduleRuntime: "/web/…/module-runtime.ts" });
 */
export function widgetEntrySource(
  module: ExportedWidgetModule,
  runtime: WidgetModuleRuntimePaths,
): string {
  return [
    `import { mountWidget } from ${JSON.stringify(runtime.mountWidget)};`,
    `import { moduleDuckDbLive } from ${JSON.stringify(runtime.moduleRuntime)};`,
    `const spec = ${JSON.stringify(module.spec)};`,
    `const layer = moduleDuckDbLive();`,
    `export default (container, options = {}) => mountWidget(container, spec, { ...options, layer });`,
    "",
  ].join("\n");
}

/**
 * Every widget module the project's pages declare, one per `export="name"`
 * tag: the page compiles, the tag's query closure and tables are computed,
 * and a name declared by two pages fails the build. An empty result means
 * the build emits no widget modules.
 *
 * @example
 * const modules = await widgetExports("/site"); // → [{ name: "revenue-by-region", … }]
 */
export async function widgetExports(
  projectRoot: string,
): Promise<ExportedWidgetModule[]> {
  const config = await loadBiacConfig(projectRoot);
  const queryFiles = diskQueryFiles(projectRoot);
  const loadTranslations = () => loadProjectTranslations(projectRoot);
  const compiled = await Promise.all(
    discoverPages(projectRoot).map(async (entry) => ({
      file: entry.file,
      page: await compilePage(
        await readFile(join(projectRoot, entry.file), "utf8"),
        entry.file,
        config.sqlTables,
        config.brand,
        queryFiles,
        loadTranslations,
      ),
    })),
  );
  const modules = compiled.flatMap(({ file, page }) =>
    page.exportedWidgets.map((tag) => ({
      name: tag.name,
      file,
      spec: specForWidget(tag, page, config.sqlTables, config.layout),
    })),
  );
  assertUniqueExportNames(modules);
  return modules;
}

/**
 * The blocks a widget's query depends on: the named block plus every block
 * its SQL inlines through `{{name}}`, transitively, in page order. A cycle
 * is kept — the registry's interpolation reports it at run time exactly as
 * it does on the page.
 *
 * @example
 * blockClosure("a", [a, b]); // a's sql reads {{b}} → [a, b]
 */
export function blockClosure(
  start: string,
  blocks: readonly SqlBlock[],
): SqlBlock[] {
  const byName = new Map(blocks.map((block) => [block.name, block]));
  const closure = new Set<string>([start]);
  const queue = [start];
  for (let next = queue.shift(); next; next = queue.shift()) {
    const block = byName.get(next);
    if (!block) continue;
    for (const token of blockTokens(block.sql)) {
      if (byName.has(token) && !closure.has(token)) {
        closure.add(token);
        queue.push(token);
      }
    }
  }
  return blocks.filter((block) => closure.has(block.name));
}

/** A block's `{{…}}` tokens minus the two binding prefixes the registry binds itself. */
function blockTokens(sql: string): string[] {
  return [...sql.matchAll(TEMPLATE_TOKEN)]
    .map((match) => (match[1] ?? "").trim())
    .filter(
      (token) =>
        !token.startsWith("params.") && !token.startsWith("$translations."),
    );
}

/**
 * The tables the closure's SQL names, word-bounded — `orders` does not match
 * inside `orders_x`. A name appearing in a string literal is a harmless
 * false positive: one extra ranged read against a file the viewer may fetch
 * anyway (ADR-0005).
 */
export function tablesForBlocks(
  blocks: readonly SqlBlock[],
  tables: SqlTableMap,
): SqlTableMap {
  const sql = blocks.map((block) => block.sql).join("\n");
  return Object.fromEntries(
    Object.entries(tables).filter(([name]) =>
      new RegExp(`\\b${escapeRegExp(name)}\\b`).test(sql),
    ),
  );
}

function escapeRegExp(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The baked spec for one swept tag: the closure as `sqlBlocks`, the merged
 * (config ∪ page) tables filtered to the closure, and `cards` from the
 * merged layout — the page's key wins, the project default fills the rest,
 * the same merge `page-router.tsx` runs for the SPA.
 */
export function specForWidget(
  tag: ExportedWidgetTag,
  page: Pick<CompiledPage, "sqlBlocks" | "sqlTables" | "layout">,
  configTables: SqlTableMap,
  configLayout: Required<PageLayout>,
): BakedWidgetSpec {
  const sqlBlocks = blockClosure(tag.props.data, page.sqlBlocks);
  return {
    widget: tag.widget,
    props: tag.props,
    sqlBlocks,
    sqlTables: tablesForBlocks(sqlBlocks, {
      ...configTables,
      ...page.sqlTables,
    }),
    cards: { ...configLayout, ...page.layout }.cards,
  };
}

/** Two pages declaring one export name would emit one file over the other. */
function assertUniqueExportNames(
  modules: readonly ExportedWidgetModule[],
): void {
  const byName = new Map<string, string>();
  for (const module of modules) {
    const file = byName.get(module.name);
    if (file !== undefined) {
      throw new Error(
        `Export name "${module.name}" is declared in ${file} and ${module.file} — export names must be unique across the project`,
      );
    }
    byName.set(module.name, module.file);
  }
}
