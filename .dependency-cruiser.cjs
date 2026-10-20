// Architectural boundary rules. Grow this list as components land, keeping
// every rule backed by a stated reason.
module.exports = {
  forbidden: [
    {
      name: "ui-libraries-only-behind-components",
      comment:
        "The headless primitive library and the icon set are wrapped by " +
        "src/web/src/components/, so sizes, labels and tooltips stay " +
        "consistent and the libraries stay swappable. Features and pages " +
        "import the wrappers.",
      severity: "error",
      from: {
        path: "^src/web/src/",
        pathNot: "^src/web/src/components/",
      },
      to: {
        path: "node_modules/.*(lucide-react|@base-ui/react)/",
      },
    },
    {
      name: "chart-engine-only-behind-its-wrapper",
      comment:
        "echarts is wrapped by src/web/src/features/widgets/charts/, so mark " +
        "construction, theming and selection-event wiring stay consistent " +
        "across every chart widget and the engine stays swappable.",
      severity: "error",
      from: {
        path: "^src/web/src/",
        pathNot: "^src/web/src/features/widgets/charts/",
      },
      to: {
        path: "node_modules/.*echarts/",
      },
    },
    {
      name: "editor-engine-only-behind-its-wrapper",
      comment:
        "codemirror is wrapped by src/web/src/features/editor/, so the editor " +
        "surface (extensions, keymaps, theme) is defined in one place.",
      severity: "error",
      from: {
        path: "^src/web/src/",
        pathNot: "^src/web/src/features/editor/",
      },
      to: {
        path: "node_modules/.*(codemirror|@codemirror|@lezer)/",
      },
    },
    {
      name: "yaml-only-behind-the-translations-file",
      comment:
        "yaml is wrapped by src/engine/translations-file.ts, so parsing and " +
        "its located errors live in one module.",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: "^src/engine/translations-file(\\.unit\\.test)?\\.ts$",
      },
      to: {
        path: "node_modules/.*/yaml/",
      },
    },
    {
      name: "i18next-only-behind-translation-resolution",
      comment:
        "i18next is wrapped by src/engine/resolve-translations.ts, so it " +
        "runs at build time only and never ships to the browser.",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: "^src/engine/resolve-translations(\\.unit\\.test)?\\.ts$",
      },
      to: {
        path: "node_modules/.*/i18next/",
      },
    },
    {
      name: "syntax-highlight-only-behind-its-wrapper",
      comment:
        "shiki is wrapped by src/web/src/features/pages/, so fence rendering " +
        "and theme handling stay consistent.",
      severity: "error",
      from: {
        path: "^src/web/src/",
        pathNot: "^src/web/src/features/pages/",
      },
      to: {
        path: "node_modules/.*shiki/",
      },
    },
    {
      name: "duckdb-only-behind-data",
      comment:
        "@duckdb/duckdb-wasm and apache-arrow are wrapped by " +
        "src/web/src/features/data/, so connection lifecycle, query " +
        "cancellation and Arrow handling live behind one port.",
      severity: "error",
      from: {
        path: "^src/web/src/",
        pathNot: "^src/web/src/features/data/",
      },
      to: {
        path: "node_modules/.*(@duckdb/duckdb-wasm|apache-arrow)/",
      },
    },
    {
      name: "class-merging-only-behind-cn",
      comment:
        "clsx and tailwind-merge are composed once in " +
        "src/web/src/lib/cn.ts; a direct import would silently drop the " +
        "project's type-scale names.",
      severity: "error",
      from: { path: "^src/web/src/", pathNot: "^src/web/src/lib/cn\\.ts$" },
      to: {
        path: "node_modules/.*(clsx|tailwind-merge)/",
      },
    },
    {
      name: "engine-must-not-import-web",
      comment:
        "src/engine is the node-side page pipeline (MDX compile, manifest); " +
        "it must not reach into the browser package — the dependency runs " +
        "web -> engine output via virtual modules.",
      severity: "error",
      from: { path: "^src/engine/" },
      to: { path: "^src/web/" },
    },
    {
      name: "web-must-not-import-node",
      comment:
        "src/web runs in the browser; src/engine and src/cli are node-side. " +
        "A web -> engine/cli import would pull node builtins into the bundle.",
      severity: "error",
      from: { path: "^src/web/" },
      to: { path: "^src/(engine|cli)/" },
    },
    {
      name: "cli-must-not-import-web",
      comment:
        "src/cli composes dev/build/preview; it serves the web artifact, " +
        "never imports its modules.",
      severity: "error",
      from: { path: "^src/cli/" },
      to: { path: "^src/web/" },
    },
    {
      name: "no-circular-dependencies",
      comment: "Cycles make modules undebuggable and defeat lazy loading.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
  },
};
