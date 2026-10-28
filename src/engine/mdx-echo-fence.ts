import type {
  Code,
  Nodes,
  Paragraph,
  Parents,
  PhrasingContent,
  Root,
  RootContent,
} from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import type { Plugin, Processor } from "unified";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";

// MDX reads this flag but registers its type in `@mdx-js/mdx/lib/types.d.ts`,
// which no export of the package loads; this declares the same field.
declare module "mdast-util-mdx-jsx" {
  interface MdxJsxFlowElementData {
    _mdxExplicitJsx?: boolean | null;
  }
  interface MdxJsxTextElementData {
    _mdxExplicitJsx?: boolean | null;
  }
}

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
      const rendered = unravelJsxParagraphs(parseFenceBody(this, node, file));
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

/** How far a fence body's points sit from the page file's own. */
interface BodyShift {
  lines: number;
  columns: number;
}

type SourcePosition = NonNullable<Code["position"]>;
type SourcePoint = SourcePosition["start"];

/** The parts of a vfile-message `VFileMessage` a re-raise carries over. */
interface SyntaxFailure extends Error {
  reason: string;
  ruleId?: string;
  source?: string;
  place?: SourcePoint | SourcePosition;
}

/**
 * Parses a fence body and moves every position it reports — on the nodes
 * and on a syntax error — from the body onto the page file, so a broken
 * snippet, or a later check on its markup, names the line its author sees.
 */
function parseFenceBody(
  processor: Processor,
  node: Code,
  file: VFile,
): Root["children"] {
  const shift = bodyShift(node);
  try {
    const nodes = (processor.parse(node.value) as Root).children;
    for (const child of nodes) visit(child, (n) => shiftNode(n, shift));
    return nodes;
  } catch (error) {
    // The MDX parser throws syntax errors as `VFileMessage`s, which carry a
    // `ruleId`; anything else is a bug and propagates.
    if (!(error instanceof Error && "ruleId" in error)) throw error;
    return failAtPageLine(error as SyntaxFailure, shift, file);
  }
}

/**
 * The body starts on the line after the opening fence, and CommonMark
 * strips the fence's own indent from each body line
 * (https://spec.commonmark.org/0.31.2/#fenced-code-blocks).
 */
function bodyShift(node: Code): BodyShift {
  const start = node.position?.start;
  if (!start) return { lines: 0, columns: 0 };
  return { lines: start.line, columns: start.column - 1 };
}

/** A JSX element's attributes are not children, so `visit` never reaches them. */
function shiftNode(node: Nodes, shift: BodyShift): void {
  shiftPosition(node, shift);
  if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") {
    return;
  }
  for (const attribute of node.attributes) shiftPosition(attribute, shift);
}

function shiftPosition(
  node: { position?: SourcePosition },
  shift: BodyShift,
): void {
  const position = node.position;
  if (!position) return;
  // An offset can't be shifted across the indent stripped from each line.
  node.position = {
    start: shiftPoint(position.start, shift),
    end: shiftPoint(position.end, shift),
  };
}

function shiftPoint(point: SourcePoint, shift: BodyShift): SourcePoint {
  return {
    line: point.line + shift.lines,
    column: point.column + shift.columns,
  };
}

function failAtPageLine(
  error: SyntaxFailure,
  shift: BodyShift,
  file: VFile,
): never {
  const place =
    error.place && "start" in error.place ? error.place.start : error.place;
  return file.fail(error.reason, {
    place: place && shiftPoint(place, shift),
    ruleId: error.ruleId,
    source: error.source,
    cause: error,
  });
}

/**
 * MDX turns a paragraph holding only JSX into block JSX, and marks JSX as
 * hand-written so a component map never replaces it, in its
 * `remarkMarkAndUnravel` — which runs before every `remarkPlugins` entry
 * (`@mdx-js/mdx` `lib/core.js`) and so never sees spliced nodes. This
 * applies the same rule to them; without it a one-line `<Note>x</Note>`
 * renders inside a `<p>`.
 */
function unravelJsxParagraphs(nodes: Root["children"]): Root["children"] {
  const root: Root = { type: "root", children: nodes };
  visit(root, (node, index, parent) => {
    if (isJsxElement(node)) node.data = { ...node.data, _mdxExplicitJsx: true };
    if (node.type !== "paragraph" || !holdsOnlyJsx(node)) return;
    if (parent === undefined || index === undefined) return;
    parent.children.splice(
      index,
      1,
      ...node.children.filter(isContent).map(asFlow),
    );
    return index;
  });
  return root.children;
}

function isJsxElement(
  node: Nodes,
): node is MdxJsxFlowElement | MdxJsxTextElement {
  return node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";
}

function holdsOnlyJsx(paragraph: Paragraph): boolean {
  const content = paragraph.children.filter(isContent);
  if (content.length === 0) return false;
  return content.every(
    (child) =>
      child.type === "mdxJsxTextElement" || child.type === "mdxTextExpression",
  );
}

/** HTML whitespace (https://infra.spec.whatwg.org/#ascii-whitespace) is no content. */
function isContent(node: PhrasingContent): boolean {
  return !(node.type === "text" && /^[\t\n\f\r ]*$/.test(node.value));
}

/** Only JSX and expressions reach here, so the block form holds the same fields. */
function asFlow(node: PhrasingContent): RootContent {
  if (node.type === "mdxJsxTextElement") {
    return { ...node, type: "mdxJsxFlowElement" } as RootContent;
  }
  return { ...node, type: "mdxFlowExpression" } as RootContent;
}

function spliceBefore(
  parent: Parents,
  index: number,
  nodes: Root["children"],
): void {
  (parent.children as Root["children"]).splice(index, 0, ...nodes);
}
