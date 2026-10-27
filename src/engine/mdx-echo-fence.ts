import type { Code, Parents, Root } from "mdast";
import type { Plugin, Processor } from "unified";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";

/**
 * Remark plugin that renders a ` ```mdx echo ` fence's markup and keeps
 * the fence to show it: the fence body is parsed with the page's own
 * processor (MDX and every syntax extension registered before this plugin)
 * and its nodes are spliced in ahead of the fence, so readers see the live
 * output, then the markup that made it, from one copy in the page file. A
 * plain ` ```mdx ` fence stays code-only; any other attribute fails the
 * page at the fence. Runs right after the syntax extensions, so spliced
 * markup meets every later check exactly as hand-written markup does.
 *
 * @example
 * await compile("```mdx echo\n<Table data=\"orders\" />\n```\n", {
 *   remarkPlugins: [remarkGfm, remarkSpliceMdxEcho],
 * }); // renders <Table data="orders" />, then the fence as code
 */
export const remarkSpliceMdxEcho: Plugin<[], Root> = function (
  this: Processor,
) {
  return (tree, file) => {
    visit(tree, "code", (node: Code, index, parent) => {
      if (!isEchoFence(node, file) || parent === undefined) return;
      if (index === undefined) return;
      const rendered = (this.parse(node.value) as Root).children;
      spliceBefore(parent, index, rendered);
      node.meta = null;
      return [SKIP, index + rendered.length + 1];
    });
  };
};

function isEchoFence(node: Code, file: VFile): boolean {
  if (node.lang !== "mdx") return false;
  const meta = node.meta?.trim();
  if (!meta) return false;
  if (meta === "echo") return true;
  file.fail(
    `Unknown mdx fence attribute "${meta}" — expected \`mdx echo\``,
    node.position,
  );
}

function spliceBefore(
  parent: Parents,
  index: number,
  nodes: Root["children"],
): void {
  (parent.children as Root["children"]).splice(index, 0, ...nodes);
}
