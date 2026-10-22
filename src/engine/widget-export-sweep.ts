import type { Root } from "mdast";
import type {
  MdxJsxAttribute,
  MdxJsxFlowElement,
  MdxJsxTextElement,
} from "mdast-util-mdx-jsx";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { didYouMean } from "./closest-key.js";
import type { ExportedWidgetTag, SqlBlock } from "./types.js";

/**
 * The widget tags a module can export — the web's mount entry
 * (`src/web/src/features/widget-module/mount-widget.tsx`) renders exactly
 * these. Grows as more widgets become exportable.
 */
export const EXPORTABLE_WIDGETS = ["BarChart"] as const;

// One filename segment under build/widgets/: no dots, slashes or "..", so an
// export name can never escape the directory or collide with an extension.
const EXPORT_NAME = /^[a-z0-9][a-z0-9-]*$/;

/** Attributes an exported widget may not carry: the module has no filter coordinator. */
const UNEXPORTABLE_PROPS = new Set(["filters", "select"]);

/** What the sweep reads and fills, carried by {@link compilePage}'s metadata. */
export interface WidgetExportSweep {
  readonly sqlBlocks: readonly SqlBlock[];
  readonly exportedWidgets: ExportedWidgetTag[];
}

/**
 * Remark plugin that records each widget tag carrying `export="name"` into
 * the page's `exportedWidgets` and strips the attribute, so the compiled
 * page never passes it to the widget's props. Runs after `remarkQueryFiles`,
 * so the page's sql blocks — fences and query files — are all collected
 * when the `data` reference is checked. Every rule failure is a located
 * compile error at the offending attribute.
 *
 * @example
 * compile('<BarChart data="q" x="a" y="b" export="chart" />', {
 *   remarkPlugins: [[remarkWidgetExports, sweep]],
 * }); // sweep.exportedWidgets → [{ name: "chart", widget: "BarChart", props: {…} }]
 */
export const remarkWidgetExports: Plugin<[WidgetExportSweep], Root> =
  (sweep) => (tree, file) => {
    visit(tree, (node) => {
      if (
        node.type !== "mdxJsxFlowElement" &&
        node.type !== "mdxJsxTextElement"
      )
        return;
      sweepElement(node as MdxJsxFlowElement | MdxJsxTextElement, sweep, file);
    });
  };

function sweepElement(
  element: MdxJsxFlowElement | MdxJsxTextElement,
  sweep: WidgetExportSweep,
  file: VFile,
): void {
  const exportAttribute = element.attributes.find(
    (attribute): attribute is MdxJsxAttribute =>
      attribute.type === "mdxJsxAttribute" && attribute.name === "export",
  );
  if (!exportAttribute) return;
  const tag = element.name;
  const name = exportAttribute.value;
  if (typeof name !== "string") {
    file.fail(
      "export on <" +
        String(tag) +
        "> — expected a literal string name; a computed value is not known at build",
      exportAttribute.position,
    );
  }
  if (tag === null) {
    file.fail(
      `export="${name}" on a fragment — expected an exportable widget tag`,
      exportAttribute.position,
    );
  }
  if (!isExportable(tag)) {
    file.fail(
      `export="${name}" on <${tag}> — ${tag} is not an exportable widget; expected one of: ${EXPORTABLE_WIDGETS.join(", ")}`,
      exportAttribute.position,
    );
  }
  if (!EXPORT_NAME.test(name)) {
    file.fail(
      `export="${name}" on <${tag}> — expected a lowercase kebab-case name (letters, digits, hyphens)`,
      exportAttribute.position,
    );
  }
  const earlier = sweep.exportedWidgets.some((widget) => widget.name === name);
  if (earlier) {
    file.fail(
      `Duplicate export name "${name}" — already declared on this page`,
      exportAttribute.position,
    );
  }
  const props = literalProps(element, tag, name, file);
  rejectUnexportableProps(element, tag, name, file);
  const data = props.data;
  const blockNames = sweep.sqlBlocks.map((block) => block.name);
  if (data === undefined || !blockNames.includes(data)) {
    file.fail(
      `export="${name}" on <${tag}> — no sql block named "${String(data)}" on this page${didYouMean(String(data), blockNames)}`,
      exportAttribute.position,
    );
  }
  sweep.exportedWidgets.push({
    name,
    widget: tag,
    props: { ...props, data },
  });
  element.attributes = element.attributes.filter(
    (attribute) => attribute !== exportAttribute,
  );
}

function isExportable(tag: string | null): boolean {
  return (
    tag !== null && (EXPORTABLE_WIDGETS as readonly string[]).includes(tag)
  );
}

/**
 * The tag's literal string attributes. A computed attribute — an expression
 * value or a spread — fails the export: the build bakes props as written,
 * and a computed value is not known until the page runs.
 */
function literalProps(
  element: MdxJsxFlowElement | MdxJsxTextElement,
  tag: string,
  name: string,
  file: VFile,
): Record<string, string> {
  const props: Record<string, string> = {};
  for (const attribute of element.attributes) {
    if (attribute.type === "mdxJsxExpressionAttribute") {
      file.fail(
        `a computed attribute on exported <${tag} export="${name}"> — expected literal string attributes; a computed value is not known at build`,
        attribute.position,
      );
    }
    const { name: key, value } = attribute as MdxJsxAttribute;
    if (key === "export") continue;
    if (typeof value !== "string") {
      file.fail(
        `${key} on exported <${tag} export="${name}"> — expected a literal string; a computed value is not known at build`,
        attribute.position,
      );
    }
    props[key] = value;
  }
  return props;
}

function rejectUnexportableProps(
  element: MdxJsxFlowElement | MdxJsxTextElement,
  tag: string,
  name: string,
  file: VFile,
): void {
  for (const attribute of element.attributes) {
    const key = attribute.type === "mdxJsxAttribute" ? attribute.name : null;
    if (key === null || !UNEXPORTABLE_PROPS.has(key)) continue;
    file.fail(
      `export="${name}" on <${tag}> — an exported widget cannot carry filters; remove ${key} or drop the export`,
      attribute.position,
    );
  }
}
