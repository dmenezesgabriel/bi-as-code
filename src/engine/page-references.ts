import { compile, type CompileOptions } from "@mdx-js/mdx";
import type { Nodes, Root } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import remarkGfm from "remark-gfm";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { remarkSpliceMdxEcho } from "./mdx-echo-fence.js";
import { positionedPageFile } from "./page-frontmatter.js";

/** A link's `href` as written, and the page-file line it is written on. */
export interface PageLink {
  href: string;
  line: number;
}

/** An image's `src` as written, and the page-file line it is written on. */
export interface PageImage {
  src: string;
  line: number;
}

/** Every link and image a page renders, each ordered by page-file line. */
export interface PageReferences {
  links: PageLink[];
  images: PageImage[];
}

interface ReferenceDefinition {
  identifier: string;
  url: string;
  line: number;
}

// What one visit of the tree finds. A `[r]: url` definition is a link or an
// image only by how the page uses it, which is known once the whole tree
// has been visited, so definitions and the identifiers that use them are
// kept apart until then.
interface Collection extends PageReferences {
  definitions: ReferenceDefinition[];
  linkIdentifiers: Set<string>;
  imageIdentifiers: Set<string>;
}

/**
 * Every link and image a page renders: markdown links and images, reference
 * definitions (an image when only `![alt][ref]` uses them, a link
 * otherwise) and `<a>` / `<img>` elements with a literal `href` / `src` —
 * including those an ` ```mdx echo ` fence renders — each at its line in
 * the page file. An expression-valued attribute is only known at run time
 * and is left out, and so is every reference of a page that does not
 * compile.
 *
 * @example
 * await pageReferences("# T\n\n[a](/b)\n\n![c](/data/c.png)\n", "pages/t.md");
 * // → { links: [{ href: "/b", line: 3 }], images: [{ src: "/data/c.png", line: 5 }] }
 */
export async function pageReferences(
  markdown: string,
  filePath: string,
): Promise<PageReferences> {
  const collection = emptyCollection();
  try {
    await compile(
      positionedPageFile(markdown, filePath),
      collectingOptions(collection),
    );
  } catch (error) {
    // The MDX compiler throws a page's own errors as `VFileMessage`s, which
    // carry a `ruleId`; the page transform reports those at the page file,
    // so the build still fails, naming the page. Anything else is a bug.
    if (!(error instanceof Error && "ruleId" in error)) throw error;
    return { links: [], images: [] };
  }
  return resolveDefinitions(collection);
}

function emptyCollection(): Collection {
  return {
    links: [],
    images: [],
    definitions: [],
    linkIdentifiers: new Set(),
    imageIdentifiers: new Set(),
  };
}

// The splice runs first, as in the page compiler, so references an echo
// fence renders are collected at their page lines.
function collectingOptions(collection: Collection): CompileOptions {
  return {
    format: "mdx",
    remarkPlugins: [
      remarkGfm,
      remarkSpliceMdxEcho,
      [remarkCollectReferences, collection],
    ],
  };
}

const remarkCollectReferences: Plugin<[Collection], Root> =
  (collection) => (tree) => {
    visit(tree, (node: Nodes) => collectNode(node, collection));
  };

function collectNode(node: Nodes, collection: Collection): void {
  const line = node.position?.start.line;
  if (line === undefined) return;
  switch (node.type) {
    case "link":
      collection.links.push({ href: node.url, line });
      return;
    case "image":
      collection.images.push({ src: node.url, line });
      return;
    case "definition":
      collection.definitions.push({
        identifier: node.identifier,
        url: node.url,
        line,
      });
      return;
    case "linkReference":
      collection.linkIdentifiers.add(node.identifier);
      return;
    case "imageReference":
      collection.imageIdentifiers.add(node.identifier);
      return;
    case "mdxJsxFlowElement":
    case "mdxJsxTextElement":
      collectJsxElement(node, line, collection);
  }
}

function collectJsxElement(
  node: MdxJsxFlowElement | MdxJsxTextElement,
  line: number,
  collection: Collection,
): void {
  const href = node.name === "a" ? literalAttribute(node, "href") : undefined;
  if (href !== undefined) collection.links.push({ href, line });
  const src = node.name === "img" ? literalAttribute(node, "src") : undefined;
  if (src !== undefined) collection.images.push({ src, line });
}

function literalAttribute(
  node: MdxJsxFlowElement | MdxJsxTextElement,
  name: string,
): string | undefined {
  for (const attribute of node.attributes) {
    if (attribute.type !== "mdxJsxAttribute" || attribute.name !== name)
      continue;
    return typeof attribute.value === "string" ? attribute.value : undefined;
  }
}

// A definition an image uses is an image; one a link uses, or nothing uses,
// is a link — so an unused definition is still checked as before.
function resolveDefinitions(collection: Collection): PageReferences {
  const { links, images } = collection;
  for (const { identifier, url, line } of collection.definitions) {
    const usedByImage = collection.imageIdentifiers.has(identifier);
    if (usedByImage) images.push({ src: url, line });
    if (!usedByImage || collection.linkIdentifiers.has(identifier))
      links.push({ href: url, line });
  }
  return {
    links: links.sort((a, b) => a.line - b.line),
    images: images.sort((a, b) => a.line - b.line),
  };
}
